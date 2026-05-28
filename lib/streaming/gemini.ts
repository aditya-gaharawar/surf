import { Sandbox } from "@e2b/desktop";
import { SSEEventType, SSEEvent, sleep } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError, logWarning } from "../logger";
import { ComputerAction } from "@/types/computer";

// Gemini model and generation endpoint identifiers
export const GEMINI_MODEL = "gemini-3.1-flash-lite";
export const GENERATE_CONTENT_API = "streamGenerateContent";

const INSTRUCTIONS = `
You are CUA, WEBSPACEAI's computer-use assistant for operating a live browser-accessible Linux desktop.
WEBSPACEAI is the organization behind this experience. Website: https://webspaceai.in.

You receive a screenshot from an isolated Ubuntu desktop sandbox and a user task. Decide the next small batch of computer actions needed to complete the task. Use the desktop carefully and visibly: open apps, browse the web, edit files, and interact with UI elements only when helpful for the user's goal.

The sandbox includes common desktop tools such as Firefox, VS Code, LibreOffice, Python 3, Terminal, file manager, text editor, and calculator.

Return ONLY valid JSON. Do not wrap it in markdown. The JSON shape must be:
{
  "reasoning": "short user-visible explanation of what you are doing next",
  "done": false,
  "answer": "final answer only when done is true",
  "actions": [
    { "type": "click", "button": "left", "x": 100, "y": 200 },
    { "type": "type", "text": "hello" },
    { "type": "keypress", "keys": ["ENTER"] },
    { "type": "wait" }
  ]
}

Supported actions:
- click: {"type":"click","button":"left"|"right"|"wheel","x":number,"y":number}
- double_click: {"type":"double_click","x":number,"y":number}
- type: {"type":"type","text":string}
- keypress: {"type":"keypress","keys":string[]} such as ["ENTER"], ["CTRL","L"], ["CTRL","S"]
- move: {"type":"move","x":number,"y":number}
- scroll: {"type":"scroll","scroll_x":number,"scroll_y":number,"x":number,"y":number}
- drag: {"type":"drag","path":[{"x":number,"y":number},{"x":number,"y":number}]}
- wait: {"type":"wait"}
- screenshot: {"type":"screenshot"}

Use at most 5 actions per turn. Prefer keyboard shortcuts when reliable. If the task is complete, set done=true and actions=[].`;

const TYPE_ACTION_CHUNK_SIZE = 50;
const TYPE_ACTION_DELAY_MS = 25;
const INTERSTITIAL_WAIT_DELAY_MS = 800;
const ASYNC_BATCH_FALLBACK_DELAY_MS = 150;
const MAX_TURNS = 40;

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type CapturedScreenshot = {
  base64: string;
  byteLength: number;
  captureDurationMs: number;
};

type GeminiContent = {
  role?: "user" | "model";
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  >;
};

type GeminiDecision = {
  reasoning?: string;
  done?: boolean;
  answer?: string;
  actions?: ComputerAction[];
};

function previewText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function summarizeAction(action: ComputerAction) {
  switch (action.type) {
    case "click":
      return {
        type: action.type,
        button: action.button,
        x: action.x,
        y: action.y,
      };
    case "double_click":
      return {
        type: action.type,
        x: action.x,
        y: action.y,
      };
    case "drag":
      return {
        type: action.type,
        path_length: action.path.length,
        start: action.path[0],
        end: action.path[action.path.length - 1],
      };
    case "keypress":
      return {
        type: action.type,
        keys: action.keys,
      };
    case "move":
      return {
        type: action.type,
        x: action.x,
        y: action.y,
      };
    case "scroll":
      return {
        type: action.type,
        scroll_x: action.scroll_x,
        scroll_y: action.scroll_y,
        x: action.x,
        y: action.y,
      };
    case "type":
      return {
        type: action.type,
        text_length: action.text.length,
        text_preview: previewText(action.text, 80),
      };
    case "wait":
    case "screenshot":
      return {
        type: action.type,
      };
  }
}

function getWaitRunLengths(actions: ComputerAction[]): number[] {
  const runs: number[] = [];
  let currentRunLength = 0;

  for (const action of actions) {
    if (action.type === "wait") {
      currentRunLength += 1;
      continue;
    }

    if (currentRunLength > 0) {
      runs.push(currentRunLength);
      currentRunLength = 0;
    }
  }

  if (currentRunLength > 0) {
    runs.push(currentRunLength);
  }

  return runs;
}

function getTrailingWaitCount(actions: ComputerAction[]): number {
  let count = 0;

  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index]?.type !== "wait") {
      break;
    }

    count += 1;
  }

  return count;
}

function isAsyncKeypress(action: Extract<ComputerAction, { type: "keypress" }>) {
  const normalizedKeys = action.keys.map((key) => key.toUpperCase());

  return normalizedKeys.some((key) =>
    ["ENTER", "RETURN", "TAB", "ESCAPE"].includes(key)
  );
}

function shouldApplyFallbackDelay(actions: ComputerAction[]): boolean {
  if (getTrailingWaitCount(actions) > 0) {
    return false;
  }

  return actions.some((action) => {
    switch (action.type) {
      case "click":
      case "double_click":
      case "drag":
      case "scroll":
        return true;
      case "keypress":
        return isAsyncKeypress(action);
      default:
        return false;
    }
  });
}

function normalizeKey(key: string): string {
  const upperKey = key.toUpperCase();
  const aliases: Record<string, string> = {
    RETURN: "ENTER",
    ESC: "ESCAPE",
    CMD: "META",
    COMMAND: "META",
  };

  return aliases[upperKey] ?? upperKey;
}

function normalizeAction(action: unknown): ComputerAction | null {
  if (!action || typeof action !== "object") {
    return null;
  }

  const raw = action as Record<string, unknown>;
  const type = raw.type;

  if (typeof type !== "string") {
    return null;
  }

  const numberOrZero = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  switch (type) {
    case "screenshot":
      return { type };
    case "double_click":
      return { type, x: numberOrZero(raw.x), y: numberOrZero(raw.y) };
    case "click": {
      const button = raw.button === "right" || raw.button === "wheel" ? raw.button : "left";
      return { type, button, x: numberOrZero(raw.x), y: numberOrZero(raw.y) };
    }
    case "type":
      return { type, text: typeof raw.text === "string" ? raw.text : "" };
    case "keypress": {
      const keys = Array.isArray(raw.keys)
        ? raw.keys.filter((key): key is string => typeof key === "string").map(normalizeKey)
        : [];
      return { type, keys };
    }
    case "move":
      return { type, x: numberOrZero(raw.x), y: numberOrZero(raw.y) };
    case "scroll":
      return {
        type,
        scroll_x: numberOrZero(raw.scroll_x),
        scroll_y: numberOrZero(raw.scroll_y),
        x: numberOrZero(raw.x),
        y: numberOrZero(raw.y),
      };
    case "wait":
      return { type };
    case "drag": {
      const path = Array.isArray(raw.path)
        ? raw.path
          .filter((point): point is Record<string, unknown> => !!point && typeof point === "object")
          .map((point) => ({ x: numberOrZero(point.x), y: numberOrZero(point.y) }))
        : [];

      return path.length >= 2 ? { type, path } : null;
    }
    default:
      return null;
  }
}

function extractJson(text: string): GeminiDecision {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] ?? trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return {
      reasoning: trimmed || "Gemini returned no structured action plan.",
      done: true,
      answer: trimmed || "I could not determine the next computer action.",
      actions: [],
    };
  }

  const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as GeminiDecision;
  const actions = Array.isArray(parsed.actions)
    ? parsed.actions.map(normalizeAction).filter((action): action is ComputerAction => !!action).slice(0, 5)
    : [];

  return {
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
    done: Boolean(parsed.done),
    answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    actions,
  };
}

function extractTextFromGeminiChunk(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") {
    return "";
  }

  const candidates = (chunk as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    return "";
  }

  return candidates
    .flatMap((candidate) => {
      const content = (candidate as { content?: { parts?: unknown } }).content;
      const parts = content?.parts;
      if (!Array.isArray(parts)) {
        return [];
      }

      return parts.map((part) =>
        typeof (part as { text?: unknown }).text === "string"
          ? ((part as { text: string }).text)
          : ""
      );
    })
    .join("");
}

function messagesToGeminiContents(
  messages: { role: "user" | "assistant"; content: string }[]
): GeminiContent[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export class GeminiComputerStreamer implements ComputerInteractionStreamerFacade {
  public instructions: string;
  public desktop: Sandbox;
  public resolution: [number, number];

  constructor(desktop: Sandbox, resolution: [number, number]) {
    this.desktop = desktop;
    this.resolution = resolution;
    this.instructions = INSTRUCTIONS;
  }

  private async captureScreenshot(): Promise<CapturedScreenshot> {
    const captureStartedAt = Date.now();
    const screenshotData = Buffer.from(await this.desktop.screenshot());

    return {
      base64: screenshotData.toString("base64"),
      byteLength: screenshotData.length,
      captureDurationMs: Date.now() - captureStartedAt,
    };
  }

  private async captureBatchScreenshot(context: {
    actions: ComputerAction[];
    traceId: string;
    turnIndex: number;
  }): Promise<{
    screenshot: CapturedScreenshot;
    fallbackDelayMs: number;
    captureTiming: "immediately_after_batch" | "after_fallback_delay";
  }> {
    const { actions, traceId, turnIndex } = context;
    const fallbackDelayMs = shouldApplyFallbackDelay(actions)
      ? ASYNC_BATCH_FALLBACK_DELAY_MS
      : 0;

    logDebug("GEMINI_BATCH_SCREENSHOT_DELAY", {
      traceId,
      turnIndex,
      fallback_delay_ms: fallbackDelayMs,
      trailing_wait_count: getTrailingWaitCount(actions),
    });

    if (fallbackDelayMs > 0) {
      await sleep(fallbackDelayMs);
    }

    return {
      screenshot: await this.captureScreenshot(),
      fallbackDelayMs,
      captureTiming:
        fallbackDelayMs > 0 ? "after_fallback_delay" : "immediately_after_batch",
    };
  }

  private async askGemini(context: {
    contents: GeminiContent[];
    screenshot: CapturedScreenshot;
    signal: AbortSignal;
    traceId: string;
    turnIndex: number;
  }): Promise<GeminiDecision> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not found");
    }

    const model = GEMINI_MODEL;
    const method = GENERATE_CONTENT_API;
    const endpoint = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:${method}?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const contents: GeminiContent[] = [
      ...context.contents,
      {
        role: "user",
        parts: [
          {
            text: `Current desktop screenshot. Resolution: ${this.resolution[0]}x${this.resolution[1]}. Return the next JSON action plan.`,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: context.screenshot.base64,
            },
          },
        ],
      },
    ];

    logDebug("GEMINI_STREAM_START", {
      traceId: context.traceId,
      turnIndex: context.turnIndex,
      model,
      method,
      resolution: this.resolution,
      content_count: contents.length,
      screenshot_bytes: context.screenshot.byteLength,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: this.instructions }],
        },
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      signal: context.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${previewText(errorText, 400)}`);
    }

    if (!response.body) {
      throw new Error("Gemini response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const lines = event.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            text += extractTextFromGeminiChunk(JSON.parse(data));
          } catch (error) {
            logWarning("Unable to parse Gemini SSE chunk:", error);
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        text += extractTextFromGeminiChunk(JSON.parse(data));
      }
    }

    logDebug("GEMINI_RESPONSE_RECEIVED", {
      traceId: context.traceId,
      turnIndex: context.turnIndex,
      output_text_preview: previewText(text),
    });

    return extractJson(text);
  }

  async executeAction(action: ComputerAction): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    switch (action.type) {
      case "screenshot": {
        break;
      }
      case "double_click": {
        await desktop.doubleClick(action.x, action.y);
        break;
      }
      case "click": {
        if (action.button === "left") {
          await desktop.leftClick(action.x, action.y);
        } else if (action.button === "right") {
          await desktop.rightClick(action.x, action.y);
        } else if (action.button === "wheel") {
          await desktop.middleClick(action.x, action.y);
        }
        break;
      }
      case "type": {
        await desktop.write(action.text, {
          chunkSize: TYPE_ACTION_CHUNK_SIZE,
          delayInMs: TYPE_ACTION_DELAY_MS,
        });
        break;
      }
      case "keypress": {
        await desktop.press(action.keys);
        break;
      }
      case "move": {
        await desktop.moveMouse(action.x, action.y);
        break;
      }
      case "scroll": {
        if (action.scroll_y < 0) {
          await desktop.scroll("up", Math.abs(action.scroll_y));
        } else if (action.scroll_y > 0) {
          await desktop.scroll("down", action.scroll_y);
        }
        break;
      }
      case "wait": {
        await sleep(INTERSTITIAL_WAIT_DELAY_MS);
        break;
      }
      case "drag": {
        const start = action.path[0];
        const end = action.path[action.path.length - 1];
        const startCoordinate: [number, number] = [start.x, start.y];
        const endCoordinate: [number, number] = [end.x, end.y];

        await desktop.drag(startCoordinate, endCoordinate);
        break;
      }
      default: {
        logWarning("Unknown action type:", action);
      }
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent> {
    const { messages, signal } = props;
    const traceId = `gemini-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let turnIndex = 0;
    const contents = messagesToGeminiContents(messages);

    try {
      let screenshot = await this.captureScreenshot();

      while (turnIndex < MAX_TURNS) {
        if (signal.aborted) {
          logDebug("GEMINI_COMPUTER_STREAM_ABORTED", { traceId, turnIndex });
          yield {
            type: SSEEventType.DONE,
            content: "Generation stopped by user",
          };
          break;
        }

        turnIndex += 1;

        const decision = await this.askGemini({
          contents,
          screenshot,
          signal,
          traceId,
          turnIndex,
        });

        if (decision.reasoning) {
          yield {
            type: SSEEventType.REASONING,
            content: decision.reasoning,
          };
        }

        contents.push({
          role: "model",
          parts: [{ text: JSON.stringify(decision) }],
        });

        if (decision.done || !decision.actions || decision.actions.length === 0) {
          yield {
            type: SSEEventType.REASONING,
            content: decision.answer || decision.reasoning || "Task completed.",
          };
          yield { type: SSEEventType.DONE };
          break;
        }

        const waitRunLengths = getWaitRunLengths(decision.actions);
        const trailingWaitCount = getTrailingWaitCount(decision.actions);
        const firstTrailingWaitIndex =
          trailingWaitCount > 0
            ? decision.actions.length - trailingWaitCount
            : Number.POSITIVE_INFINITY;

        logDebug("GEMINI_COMPUTER_ACTION_BATCH", {
          traceId,
          turnIndex,
          action_count: decision.actions.length,
          action_types: decision.actions.map((action) => action.type),
          wait_action_count: decision.actions.filter((action) => action.type === "wait").length,
          consecutive_wait_runs: waitRunLengths,
          trailing_wait_count: trailingWaitCount,
          actions: decision.actions.map((action, actionIndex) => ({
            action_index: actionIndex,
            ...summarizeAction(action),
          })),
        });

        for (const [actionIndex, action] of decision.actions.entries()) {
          const actionStartedAt = Date.now();

          yield {
            type: SSEEventType.ACTION,
            action,
          };

          logDebug("GEMINI_ACTION_EXECUTION_START", {
            traceId,
            turnIndex,
            action_index: actionIndex,
            action: summarizeAction(action),
          });

          if (action.type === "wait" && actionIndex >= firstTrailingWaitIndex) {
            yield { type: SSEEventType.ACTION_COMPLETED };
            continue;
          }

          await this.executeAction(action);

          logDebug("GEMINI_ACTION_EXECUTION_DONE", {
            traceId,
            turnIndex,
            action_index: actionIndex,
            action_type: action.type,
            duration_ms: Date.now() - actionStartedAt,
          });

          yield { type: SSEEventType.ACTION_COMPLETED };
        }

        const batchCapture = await this.captureBatchScreenshot({
          actions: decision.actions,
          traceId,
          turnIndex,
        });

        screenshot = batchCapture.screenshot;

        logDebug("GEMINI_SCREENSHOT_CAPTURED", {
          traceId,
          turnIndex,
          capture_duration_ms: screenshot.captureDurationMs,
          screenshot_bytes: screenshot.byteLength,
          screenshot_base64_chars: screenshot.base64.length,
          capture_timing: batchCapture.captureTiming,
          fallback_delay_ms: batchCapture.fallbackDelayMs,
        });

        contents.push({
          role: "user",
          parts: [
            {
              text: "Actions executed. Review the updated screenshot and continue, or finish if the task is complete.",
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: screenshot.base64,
              },
            },
          ],
        });
      }

      if (turnIndex >= MAX_TURNS) {
        yield {
          type: SSEEventType.ERROR,
          content: "CUA reached the maximum number of Gemini computer-use turns for this task.",
        };
        yield { type: SSEEventType.DONE };
      }
    } catch (error) {
      logError("GEMINI_STREAMER", error);
      yield {
        type: SSEEventType.ERROR,
        content: "An error occurred with the Gemini AI service. Please try again.",
      };
      yield { type: SSEEventType.DONE };
    }
  }
}
