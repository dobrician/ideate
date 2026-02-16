# Sprint 20 — Coverage Gaps, Dead Code & Production Hardening (2026-02-16)
**Status:** COMPLETE (5/8 goals — remaining deferred to future sprints)

## Goals

- [x] Goal 1: New logo — header, favicon, PWA manifest (Issue #40)
- [x] Goal 2: Cover csrf-client.ts (0% coverage)
- [x] Goal 3: Cover proposals/actions.ts uncovered error paths
- [x] Goal 4: Cover auth.ts uncovered branches (83% branch)
- [x] Goal 5: Cover notifications.ts debounce edge cases (83% branch)
- [ ] ~~Goal 6: Remove remaining dead code from Sprint 16 audit~~ (deferred)
- [ ] ~~Goal 7: Cover export.ts branch coverage (79% branch)~~ (deferred)
- [ ] ~~Goal 8: Sprint 20 log + checklist~~ (skipped — Sprint 21 started)

## Outcomes
- 5/8 goals completed, 616 tests passing
- Logo updated with new ballot-box icon (transparent bg, all favicon sizes)
- Coverage gaps closed for csrf-client, proposals/actions, auth, notifications
- Sprint interrupted to prioritize migration fixes + AI E2E testing (Sprint 21)

## Constraints
- Commit + push after EACH goal
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
- All files < 300 lines
