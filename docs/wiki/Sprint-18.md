# Sprint 18 — UI Polish & Chat Redesign (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Vote Bar Polish:**
- [x] Fix background padding — extend to full card width, edge-to-edge (#37)
- [ ] Remove solid vote bars and percentage labels — keep only title background + vote count icons (#38)

**Chat/Comments Redesign (#39):**
- [ ] Add proper padding throughout comment drawer and project comments section (#39)
- [ ] Input UX: single-line input + button on same row. Enter = submit, Ctrl+Enter = new line (#39)
- [ ] Real-time: new comments appear without page reload — use optimistic update or polling (#39)
- [ ] Messenger layout: chat box at bottom, messages scroll up, user avatars, chat bubbles, timestamps (#39)

**From Analysis:**
- [ ] Increase test coverage: stat-card branches, db/index migration paths, mail.ts SMTP fallbacks
- [ ] Remove unused CSS classes and dead translation keys from Sprint 14-17 refactors

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
