1. **rAF-guard `scrollToBottom`** (`chat.js:258`) — One-line fix, eliminates dozens of forced layouts per second during streaming.

2. **Append text nodes instead of rewriting** (`chat.js:113-114`) — Instead of reassigning the full `textContent` on every chunk, append a new text node. Avoids O(n²) string growth during long responses.

3. **Batch state notifications with microtask** (`state.js:33-36`) — Coalesce rapid-fire `notify()` calls (e.g. during streaming) into a single microtask so subscribers fire once per tick instead of per chunk.

### Medium Impact

4. **Diff task queue instead of full re-render** (`task-queue.js:24-28`) — `innerHTML = ''` destroys and recreates all cards. Update existing cards by `data-id` and only add/remove what changed.

5. **Mutate arrays in `appendState`** (`state.js:40-41`) — Push to the existing array instead of spreading into a new one. Eliminates O(n) copies on every append during streaming.

### Low Effort / Housekeeping

6. **Exponential backoff on WS reconnect** (`ws-client.js:52`) — Prevents hammering the server. A few lines.

7. **Extract shared `escapeHtml`** — Three identical copies. One shared function, fewer bytes, one place to optimize later.