# Sprint 18 — UI Polish & Chat Redesign (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Vote Bar Polish:**
- [x] Fix background padding — extend to full card width, edge-to-edge (#37)
- [x] Remove solid vote bars and percentage labels — keep only title background + vote count icons (#38)

**Chat/Comments Redesign (#39):**
- [x] Add proper padding throughout comment drawer and project comments section (#39)
- [x] Input UX: single-line input + button on same row. Enter = submit, Ctrl+Enter = new line (#39)
- [x] Real-time: new comments appear without page reload — use optimistic update or polling (#39)
- [x] Messenger layout: chat box at bottom, messages scroll up, user avatars, chat bubbles, timestamps (#39)

**From Analysis:**
- [x] Increase test coverage: stat-card branches, db/index migration paths, mail.ts SMTP fallbacks
- [x] Remove unused CSS classes and dead translation keys from Sprint 14-17 refactors

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push

## Outcomes
- 8 commits, **32/32 smoke** (10.3s)
- Vote bar: full-width backgrounds, removed solid bars + percentage labels
- Comments: messenger-style chat with avatars, bubbles, Enter to submit, real-time refresh
- Test coverage: stat-card, db/index, mail.ts branch coverage improved
- Cleanup: dead CSS + translation keys removed
- Fix: migration 0005 idempotent (Docker build fix)

## Notes
- Docker build broke due to non-idempotent migration — fixed by removing duplicate ALTER TABLE
- Logo added separately (not sprint goal)
