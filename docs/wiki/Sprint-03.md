# Sprint 3 — Proposals & Voting (2026-02-15)
**Status:** ✅ COMPLETE

## Goals
- [x] Proposals CRUD (create, list, view per project)
- [x] Voting system (pro/contra, +1/-1 per user per proposal)
- [x] Vote bar chart visualization (consensus view)
- [x] Threaded comments on proposals
- [x] AI summarization integration (Gemini/OpenAI pluggable)
- [x] Protected routes (auth middleware)
- [x] User profile/settings page
- [x] SQLite WAL mode + concurrent write safety (#1)

## Outcomes
- 6 commits, all tests passing
- Voting: +1/-1 per user, upsert on conflict, toggle removal, green/red highlighting
- Vote bar chart: horizontal pro/contra with percentages (pure CSS)
- Comments: threaded via parentId, max depth 3, relative time display
- AI: Gemini primary, OpenAI fallback, per-provider 15-min throttling on 429
- Auth middleware: route-level protection, public route exclusions
- Issues #1, #4 addressed
