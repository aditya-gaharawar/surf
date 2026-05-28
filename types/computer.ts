export type ComputerAction =
  | { type: "screenshot" }
  | { type: "double_click"; x: number; y: number }
  | { type: "click"; button: "left" | "right" | "wheel"; x: number; y: number }
  | { type: "type"; text: string }
  | { type: "keypress"; keys: string[] }
  | { type: "move"; x: number; y: number }
  | { type: "scroll"; scroll_x: number; scroll_y: number; x?: number; y?: number }
  | { type: "wait" }
  | { type: "drag"; path: { x: number; y: number }[] };

export type ComputerScreenshotOutput = {
  type: "computer_screenshot";
  image_url: string;
  detail?: "original" | "high" | "low" | "auto";
};
