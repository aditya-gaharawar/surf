export const SANDBOX_TIMEOUT_MS = 300_000; // 5 minutes in milliseconds

// Resolution boundaries used by the sandbox and optional screenshot scaling.
// The current Gemini computer-use path sends original-detail screenshots and
// does not actively scale them before upload.
export const MAX_RESOLUTION_WIDTH = 1024;
export const MAX_RESOLUTION_HEIGHT = 768;
export const MIN_RESOLUTION_WIDTH = 640;
export const MIN_RESOLUTION_HEIGHT = 480;

// Default resolution used when none is specified
// NOTE: This should be within the max/min bounds defined above,
// otherwise it will be scaled automatically
export const DEFAULT_RESOLUTION: [number, number] = [1024, 720];

// Gemini model and generation endpoint identifiers
export const GEMINI_MODEL = process.env.MODEL_ID || "gemini-3.1-flash-lite";
export const GENERATE_CONTENT_API = process.env.GENERATE_CONTENT_API || "streamGenerateContent";
