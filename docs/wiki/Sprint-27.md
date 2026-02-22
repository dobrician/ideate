# Sprint 27 — Voting & Proposals (2026-02-17)
**Status:** COMPLETE

## Goals

Based on unified analysis from Claude + Codex (see docs/sprint27-unified-plan.md).

**Bug fixes:**
- [x] Goal 1: Fix castVote/removeVote project-id integrity
- [x] Goal 2: Fix submit-suggested route: deadline + SSE + notifications
- [x] Goal 3: SSE robustness: keepalive leak + exponential backoff

**UX & Accessibility:**
- [x] Goal 4: Accessibility fixes (vote buttons, suggestion cards, similarity warnings)
- [x] Goal 5: Vote animation: instant optimistic feedback
- [x] Goal 6: Center-anchored vote bar with smooth transitions
- [x] Goal 7: Proposal card polish: expand/collapse animation
- [x] Goal 8: Mobile touch UX hardening

**Testing & Cleanup:**
- [x] Goal 9: Test coverage: SSE live updates E2E + useVoteStream unit
- [x] Goal 10: Cleanup: redundant filter + remove dead code

## Constraints
- Commit + push after EACH goal
- Lint + type check + tests + build must pass before each push
- All files < 300 lines
- Full unified plan in docs/sprint27-unified-plan.md
