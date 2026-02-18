# Sprint 03 — 100% Coverage Ceiling & Test Fix

**Date:** 2026-02-18
**Focus:** Fix broken proposal-list bar chart test, close all remaining branch coverage gaps (proxy, email-deliverability, search route, profile actions, proposal actions, db/index), achieve 100% coverage across all metrics

## Goals

- [x] **Goal 1: Fix broken `proposal-list.dom.test.tsx` bar chart assertions** — test expected old 50%-scaled widths but component uses full percentage (60/40/67/33/100); align test with actual rendering (Testing)
- [x] **Goal 2: Close branch gap on `app/api/search/route.ts` line 23** — test rate-limit rejection path returning 429 with Retry-After header; currently 91.66% branch (Testing)
- [x] **Goal 3: Close branch gap on `proxy.ts` line 25** — test token-expiry branch where `payload.exp + 30 < now`; currently 97.05% branch (Testing)
- [ ] **Goal 4: Close branch gap on `app/api/email-deliverability/route.ts` line 9** — test uncovered conditional; currently 87.5% branch (Testing)
- [ ] **Goal 5: Close branch gap on `app/profile/actions.ts` lines 235-236** — test fallback values for JWT_SECRET/APP_URL env vars; currently 96.29% branch (Testing)
- [ ] **Goal 6: Close branch gap on `app/projects/[id]/proposals/actions.ts` line 63** — test uncovered conditional branch; currently 98.52% branch (Testing)
- [ ] **Goal 7: Close branch gap on `db/index.ts` line 8** — test DATABASE_URL fallback path; currently 94.44% branch (Testing)
- [ ] **Goal 8: Verify 100% coverage across all metrics** — confirm stmts, branch, func, line all at 100% (Testing)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
