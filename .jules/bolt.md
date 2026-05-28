## 2024-05-28 - Chat streaming re-render penalty
**Learning:** In chat applications with streaming capabilities, new tokens and messages cause the parent component (`ChatList`) to re-render very frequently. If child components (`ChatMessage`) are not memoized, this causes an O(N) re-render penalty where all previous messages in the history are re-rendered on every token/status update.
**Action:** Always wrap large list items in `React.memo()`, especially in streaming contexts like chat interfaces where the parent state changes rapidly but historical items remain static.
