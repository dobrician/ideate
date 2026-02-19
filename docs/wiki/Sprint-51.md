# Sprint 51 — Real-time Collaboration Foundation: Live Presence & WebSocket Infrastructure

**Date:** 2026-02-19
**Focus:** Upgrade SSE to WebSockets, add user presence tracking, typing indicators foundation

## Goals

- [x] **Goal 1: WebSocket Server Upgrade** — Replace SSE with WebSocket server at `/api/ws/route.ts`. Add WebSocket client library in `src/lib/websocket/client.ts` with reconnection, heartbeat, message queuing.
- [x] **Goal 2: User Presence System** — Create `src/lib/presence/` module with `UserPresence` service. Track online users per project/proposal. Add presence table or Redis-backed presence with TTL.
- [x] **Goal 3: Typing Indicators Infrastructure** — Add typing events to WebSocket messages. Create `useTypingIndicator` hook in `src/lib/use-typing.ts`. Add typing state management with debounced cleanup.
- [x] **Goal 4: Project-level Live Updates** — Extend WebSocket to broadcast project changes (new proposals, status changes). Update project detail page to show live participant count and recent activity feed.
- [ ] **Goal 5: Connection Management** — Add connection state monitoring to admin dashboard. Implement connection limits per user (max 5). Add graceful fallback when WebSocket fails (polling mode).

## Notes
- WebSocket must work behind reverse proxies and CDNs
- Implement connection authentication using JWT tokens
- All existing SSE functionality must be preserved as fallback
- After each goal: commit+push code, update this file's checkbox, commit+push, then wiki sync
- Run tests after each goal: `npm run lint && npx tsc --noEmit && npm test`
