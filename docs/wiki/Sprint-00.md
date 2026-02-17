# Sprint 00 — Coverage, Accessibility, Security & UX Features

**Date:** 2026-02-17
**Focus:** Push branch coverage past 95%, fix deferred accessibility debt, add account lockout, proposal tags, onboarding, Sentry

## Goals

- [x] **Goal 1: Push branch coverage to 95%+** — Target `rbac.ts` (75%), `sanitize.ts` (50%), `mail.ts` (87%), `csrf.ts` (88%), `llm.ts` (88%), `db/index.ts` (83%), `search.ts` (86%), `auth.ts` (90%). Add targeted tests for each uncovered branch.

- [x] **Goal 2: Dark mode WCAG AA audit and fix** — Audit all text/background color pairs in dark mode. Fix any contrast ratio below 4.5:1 for normal text and 3:1 for large text. Deferred carry-over from Sprint 11.

- [x] **Goal 3: Icon tooltips / aria-labels on all icon-only buttons** — Find all buttons wrapping only a Lucide icon with no text label. Add `title` and `aria-label` attributes. Deferred carry-over from Sprint 11.

- [ ] **Goal 4: Account lockout after repeated auth failures** — Add `failed_login_attempts` and `locked_until` columns to users table. Lock account after 5 failures for 15 minutes. Admin unlock endpoint. Tests.

- [ ] **Goal 5: Tags/categories for proposals** — Add `tags` table + `proposal_tags` join table. Tag picker in proposal form. Filter by tag on project detail page. Tests.

- [ ] **Goal 6: Onboarding flow modal for first-time users** — Detect first login via `created_at` threshold. Show modal/tour highlighting key actions (create project, add proposal, vote). Dismissible and persistent.

- [ ] **Goal 7: Sentry error tracking integration** — Install `@sentry/nextjs`, wrap logger to send errors to Sentry, add `SENTRY_DSN` to `.env.example`. Production observability.

- [ ] **Goal 8: Sprint 00 docs — update Sprint-Log after completion** — Add Sprint 00 completion stats to Sprint-Log.md.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
