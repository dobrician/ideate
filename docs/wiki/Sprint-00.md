# Sprint 00 — Cloudflare, Coverage, Accessibility & SSO

**Date:** 2026-02-17
**Focus:** Cloudflare deployment, close coverage gaps (digest/utils/mail), search keyboard a11y, change-password, OIDC SSO, webhook resilience

## Goals

- [x] **Goal 1: Cloudflare deployment** — Pages + D1 migration, wrangler config, deploy pipeline. Moves from Docker-only to edge deployment.

- [ ] **Goal 2: Close coverage gap on `lib/digest.ts`** — Add unit tests for digest aggregation, HTML generation, and cron endpoint (currently 50% stmts).

- [ ] **Goal 3: Close coverage gap on `lib/utils.ts`** — Add tests for `formatDate`, `formatDateTime`, `formatRelativeTime` (currently 37% stmts).

- [ ] **Goal 4: Close coverage gap on `lib/mail.ts`** — Test HTML email template rendering and edge cases on lines 212-243 (currently 86% stmts).

- [ ] **Goal 5: Search keyboard navigation** — Add ArrowUp/Down/Enter handlers to search combobox, fix `aria-selected` tracking, remove misleading static ARIA attributes.

- [ ] **Goal 6: Profile change-password flow** — Add change-password form to profile page with current-password verification.

- [ ] **Goal 7: SSO foundation (OIDC)** — Add OpenID Connect login with a configurable provider (Google as default), linking OIDC accounts to existing users by email.

- [ ] **Goal 8: Improve webhook resilience** — Cover error retry paths in tests, add dead-letter logging for permanently failed deliveries.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
