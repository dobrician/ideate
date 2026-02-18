# Sprint 00 — PDF Locale Fix, PWA iOS, Server Action Rate Limiting, Admin Dashboard & Data Retention

**Date:** 2026-02-18
**Focus:** Fix hardcoded PDF locale, PWA safe-area iOS overlap, rate limiting on all server actions, admin rate-limit visibility, audit log data retention

## Goals

- [ ] **Goal 1: Fix hardcoded `en-US` locale in PDF export** — replace fallback with env-aware locale resolution in `export-pdf.ts` (Code Quality, Section 3)
- [ ] **Goal 2: PWA safe-area-inset for iOS home bar** — add `safe-area-inset-bottom` padding to PWA install banner to prevent overlap on notched devices (UX, Section 7)
- [ ] **Goal 3: Rate limiting on server actions** — add `checkRateLimit` to proposal/vote/comment/project/profile server actions (Security, Section 4)
- [ ] **Goal 4: Admin rate-limit visibility dashboard** — expose rate-limit stats (active keys, hit counts) via admin API + UI panel (Enterprise, Section 10)
- [ ] **Goal 5: Data retention policy — auto-prune old audit logs** — add configurable TTL-based cleanup for audit log entries via cron endpoint (Enterprise, Section 10)
- [ ] **Goal 6: Tests for server action rate limiting** — unit tests verifying rate-limit enforcement on proposals/votes/comments/projects/profile actions
- [ ] **Goal 7: Tests for data retention policy** — unit tests for audit log pruning logic, TTL config, and cron endpoint
- [ ] **Goal 8: Tests for admin rate-limit dashboard** — unit tests for rate-limit stats API endpoint and admin UI component

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
