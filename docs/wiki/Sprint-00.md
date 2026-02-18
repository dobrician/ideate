# Sprint 00 — Cloudflare, Coverage, Accessibility & SSO

**Date:** 2026-02-18
**Focus:** Cloudflare deployment, close coverage gaps (digest/utils/mail), search keyboard a11y, change-password, OIDC SSO, webhook resilience

## Goals

- [x] **Goal 1: Cloudflare deployment** — Pages + D1 migration, wrangler config, deploy pipeline
- [x] **Goal 2: Close coverage gap on `lib/digest.ts`** — add unit tests for digest aggregation, HTML generation, and cron endpoint (currently 50% stmts)
- [x] **Goal 3: Close coverage gap on `lib/utils.ts`** — add tests for `formatDate`, `formatDateTime`, `formatRelativeTime` (currently 37% stmts)
- [x] **Goal 4: Close coverage gap on `lib/mail.ts`** — test HTML email template rendering and edge cases on lines 212-243 (currently 86% stmts)
- [x] **Goal 5: Search keyboard navigation** — add ArrowUp/Down/Enter handlers to search combobox, fix `aria-selected` tracking, remove misleading static ARIA attributes
- [x] **Goal 6: Profile change-password flow** — add change-password form to profile page with current-password verification
- [x] **Goal 7: SSO foundation (OIDC)** — add OpenID Connect login with a configurable provider (Google as default), linking OIDC accounts to existing users by email
- [ ] **Goal 8: Improve webhook resilience** — cover error retry paths in tests, add dead-letter logging for permanently failed deliveries

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
