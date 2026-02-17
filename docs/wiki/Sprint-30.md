# Sprint 30 — Docs Hygiene, Coverage Gaps & Production Hardening

**Date:** 2026-02-17
**Focus:** Update stale docs, close coverage gaps, Cloudflare deployment spike, push branch coverage past 93%

## Goals

- [x] **Goal 1: Update Known-Issues.md** — Rewrite Open section with current risks (in-memory rate limiter, no JWT revocation, single-instance SQLite). Move resolved items to Resolved (CSRF, structured logging, concurrent writes, AI rate limiting, session security). Remove risks already addressed.

- [x] **Goal 2: Update Nice-to-Have.md** — Check off completed items: PDF/CSV export, real-time voting (SSE), email notifications, role-based access, audit logging, API rate limiting, search, structured logging, database backups, PWA, keyboard shortcuts.

- [x] **Goal 3: Cover vote-update.ts (0% coverage)** — Add unit tests for `emitVoteUpdate` helper with mocked DB and `emitVoteChange`. Small file (28 lines).

- [x] **Goal 4: Cover export.ts branch gaps (79% branch)** — Add targeted tests for uncovered lines at 59, 113-114, 391. Push branch coverage above 90%.

- [ ] **Goal 5: Cover llm.ts branch gaps (85% branch)** — Add tests for uncovered lines at 188-189 (error/fallback branches).

- [ ] **Goal 6: Update Sprint-Log.md — missing Sprints 12-29** — Sprint-Log.md only has entries for Sprints 1-3 and 11. Add summary entries for Sprints 12-29.

- [ ] **Goal 7: Cloudflare deployment spike (Issue #13)** — Write deployment spike: Pages for frontend, D1 for SQLite, Workers for API. Identify blockers. Update docs/Deployment.md.

- [ ] **Goal 8: Final coverage push — 93%+ branch** — After Goals 3-5, review remaining branch gaps. Pick easiest wins to push overall branch coverage past 93%.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
