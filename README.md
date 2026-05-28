# CUA - WEBSPACEAI Computer Use Agent

CUA is a white-labeled Next.js application from [WEBSPACEAI](https://webspaceai.in) that lets a Gemini-powered AI assistant operate a live virtual desktop from natural language instructions.

The app pairs a browser UI with an isolated desktop sandbox and Gemini's `streamGenerateContent` API so users can describe a task, watch actions happen in real time, and continue the workflow conversationally.

## Overview

CUA provides a web interface where users can:

1. Start a virtual desktop sandbox environment.
2. Send natural language instructions to the CUA assistant.
3. Watch CUA perform clicks, typing, scrolling, waiting, and other desktop actions.
4. Continue the task through a chat-style interface.

Server-Sent Events (SSE) stream sandbox creation, Gemini reasoning, computer actions, and completion events back to the browser.

## How It Works

### Architecture

The application consists of four main parts:

1. **Frontend UI (Next.js)**: Virtual desktop frame, chat interface, controls, and WEBSPACEAI branding.
2. **Desktop Sandbox**: Creates and manages isolated Linux desktop sessions through `@e2b/desktop`.
3. **Gemini Computer Planner**: Calls Gemini through `streamGenerateContent` with screenshots and asks for structured computer-action JSON.
4. **Streaming API**: Sends reasoning, actions, sandbox URLs, and completion events to the client over SSE.

### Core Flow

1. The user enters a task.
2. The backend creates or reconnects to a desktop sandbox.
3. CUA captures a screenshot of the sandbox.
4. Gemini receives the user task, current screenshot, and WEBSPACEAI CUA instructions.
5. Gemini returns a small JSON batch of desktop actions or a final answer.
6. The backend executes those actions in the sandbox, captures another screenshot, and repeats until the task is complete.
7. The frontend renders the live desktop stream and chat/action timeline.

## Prerequisites

Before starting, you'll need:

1. Node.js and npm.
2. A desktop sandbox API key.
3. A Gemini API key with access to your configured model.

## Setup Instructions

1. **Install dependencies**

```bash
npm install
```

2. **Set up environment variables**

Create a `.env.local` file in the root directory based on `.env.example`:

```env
E2B_API_KEY=your_e2b_api_key
GEMINI_API_KEY=your_gemini_api_key
MODEL_ID=gemini-3.1-flash-lite
GENERATE_CONTENT_API=streamGenerateContent
```

3. **Start the development server**

```bash
npm run dev
```

4. **Open the application**

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Type a mission or choose one of the starter prompts.
2. CUA starts a desktop sandbox when needed.
3. Watch the remote desktop stream while CUA executes actions.
4. Stop the sandbox or extend its time from the control bar.

## Features

- **WEBSPACEAI white label**: CUA metadata, logo, favicon, theme, and user-facing copy.
- **Gemini LLM stack**: Uses `GEMINI_API_KEY`, `MODEL_ID`, and `GENERATE_CONTENT_API=streamGenerateContent`.
- **Virtual desktop environment**: Runs desktop tasks in an isolated Linux sandbox.
- **Real-time streaming**: Streams assistant reasoning and actions over SSE.
- **Chat interface**: Lets users continue and refine tasks conversationally.
- **Dark/light mode**: Theme-aware UI with WEBSPACEAI-inspired accent colors.

## Technical Details

### Key Dependencies

- **Next.js / React**: Frontend and API route framework.
- **@e2b/desktop**: Desktop sandbox creation, streaming, screenshots, and input execution.
- **Gemini REST API**: Direct `streamGenerateContent` calls for model planning.
- **Tailwind CSS**: Utility-first styling and theme variables.
- **Motion**: UI transitions.

### API Endpoints

- **`/api/chat`**: Creates or connects to a sandbox and streams CUA/Gemini reasoning and actions.

### Server Actions

- **`increaseTimeout`**: Extends sandbox lifetime.
- **`stopSandboxAction`**: Stops a running sandbox instance.

## Production Notes

- Protect `/api/chat` with authentication and rate limiting before public deployment.
- Monitor Gemini and sandbox usage because every task can consume model and desktop runtime.
- Confirm your configured `MODEL_ID` supports image understanding and structured JSON generation.
- If your build environment blocks Google Fonts, self-host the fonts or replace `next/font/google` usage.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
