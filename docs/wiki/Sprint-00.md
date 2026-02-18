# Sprint 00 — Cloudflare, Coverage, Accessibility & SSO

**Date:** 2026-02-18
**Focus:** Cloudflare deployment, close coverage gaps (digest/utils/mail), search keyboard a11y, change-password, OIDC SSO, webhook resilience

## Goals

- [x] **Goal 1: Cloudflare deployment** — Pages + D1 migration, wrangler config, deploy pipeline (DevOps, Section 13)
- [x] **Goal 2: Close coverage gap on `lib/digest.ts`** — unit tests for digest aggregation, HTML generation, and cron endpoint (Testing, Section 13)
- [x] **Goal 3: Close coverage gap on `lib/utils.ts`** — tests for `formatDate`, `formatDateTime`, `formatRelativeTime` (Testing, Section 13)
- [x] **Goal 4: Close coverage gap on `lib/mail.ts`** — test HTML email template rendering and edge cases on lines 212-243 (Testing, Section 13)
- [x] **Goal 5: Search keyboard navigation** — ArrowUp/Down/Enter handlers, fix `aria-selected` tracking, remove misleading static ARIA (Accessibility, Section 13)
- [x] **Goal 6: Profile change-password flow** — change-password form with current-password verification (Feature, Section 13)
- [x] **Goal 7: SSO foundation (OIDC)** — OpenID Connect login with configurable provider, link accounts by email (Feature, Section 13)
- [ ] **Goal 8: Improve webhook resilience** — cover error retry paths in tests, dead-letter logging for failed deliveries (Testing + Reliability, Section 13)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
