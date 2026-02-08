1. **rAF-guard `scrollToBottom`** (`chat.js:258`) — One-line fix, eliminates dozens of forced layouts per second during streaming.

2. **Append text nodes instead of rewriting** (`chat.js:113-114`) — Instead of reassigning the full `textContent` on every chunk, append a new text node. Avoids O(n²) string growth during long responses.

3. **Batch state notifications with microtask** (`state.js:33-36`) — Coalesce rapid-fire `notify()` calls (e.g. during streaming) into a single microtask so subscribers fire once per tick instead of per chunk.

### Medium Impact

4. **Diff task queue instead of full re-render** (`task-queue.js:24-28`) — `innerHTML = ''` destroys and recreates all cards. Update existing cards by `data-id` and only add/remove what changed.

5. **Mutate arrays in `appendState`** (`state.js:40-41`) — Push to the existing array instead of spreading into a new one. Eliminates O(n) copies on every append during streaming.

### Low Effort / Housekeeping

6. **Exponential backoff on WS reconnect** (`ws-client.js:52`) — Prevents hammering the server. A few lines.

7. **Extract shared `escapeHtml`** — Three identical copies. One shared function, fewer bytes, one place to optimize later.


1. **Artifact cap mutation bug** (`project-context.js:176-179`) — You read `getState('sessionArtifacts')`, call `shift()` to mutate the array directly, then `appendState` which pushes to that same array. This means you're mutating state outside of `setState`, which could skip subscriber notifications for the removal. You should use `setState('sessionArtifacts', artifacts.slice(1))` before or instead of the shift, or combine into a single `setState` call.

2. **`roomName` is storing the room object, not a string** — `getState('livekitRoom')` is set via `setState('livekitRoom', room)` in `screen-share.js:91` (the LiveKit Room object). But `renderStatus` uses it with `escapeHtml(roomName)` as if it's a string. This will render as `[object Object]`. You likely want to store `room.name` separately or read it from the room object.

3. **Splitter lives in `screen-share.js`** — `initSplitter()` is UI layout logic unrelated to screen sharing. It would fit better in `project-context.js` or a dedicated layout module, since it's about panel resizing.

4. **`--screenshare-width` persistence edge case** — `parseInt(current, 10)` on a CSS custom property value like `"350px"` works, but if it ever resolves to an empty string or `undefined`, you'll store `NaN`. A fallback would be safer.

5. **Missing `--success`, `--danger`, `--warning`, `--primary` CSS variables** — `renderStatus` references these but I don't see them defined in the CSS diff. If they're not defined elsewhere, the status dots will be invisible.

6. **No cleanup for participants on page unload** — `roomParticipants` accumulates but is only cleared on `RoomEvent.Disconnected`. If the user refreshes mid-session, stale participant data could briefly appear if state is ever persisted.

7. **Minor: `file:select` event on tree-node** — Custom event name with a colon works fine but is unconventional for DOM events. Consider `fileselect` to match standard patterns (no colons).