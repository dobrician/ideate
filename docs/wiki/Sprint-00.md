# Sprint 00 — Coverage Gaps: request-utils, search, rate-limit, digest, notifications, llm, sanitize, auth

**Date:** 2026-02-18
**Focus:** Close remaining branch/statement coverage gaps across 8 library modules identified in the deep analysis report

## Goals

- [x] **Goal 1: Close coverage gap on `lib/request-utils.ts`** — add tests for getClientIp and getActionClientIp with trusted/untrusted proxy scenarios (Testing, Section 1)
- [x] **Goal 2: Close coverage gap on `lib/search.ts`** — test uncovered branches on lines 4, 216-220 (Testing, Section 1)
- [x] **Goal 3: Close coverage gap on `lib/rate-limit.ts`** — test uncovered branches on lines 26, 101 (Testing, Section 1)
- [x] **Goal 4: Close coverage gap on `lib/digest.ts`** — test uncovered branches on lines 22-23 (Testing, Section 1)
- [x] **Goal 5: Close coverage gap on `lib/notifications.ts`** — test uncovered lines 80, 138 (Testing, Section 1)
- [ ] **Goal 6: Close coverage gap on `lib/llm.ts`** — test uncovered branch/func on line 248, push branch coverage past 90% (Testing, Section 1)
- [ ] **Goal 7: Close coverage gap on `lib/sanitize.ts`** — test uncovered branch on line 20, push branch coverage past 90% (Testing, Section 1)
- [ ] **Goal 8: Close coverage gap on `lib/auth.ts`** — test uncovered branches on lines 29, 192, 245 (Testing, Section 1)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
