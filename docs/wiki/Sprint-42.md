# Sprint 42 — Security, DX & Quality

**Date:** 2026-02-18
**Focus:** Fix critical XSS vulnerability, reduce boilerplate with action wrappers, fix analytics performance, i18n errors, test fix, onboarding, proposal tags UI, accessibility polish

## Goals

- [x] **Goal 1: Fix Search XSS Vulnerability** — Sanitize `dangerouslySetInnerHTML` in `search-bar.tsx`. Only allow `<mark>` tags from FTS5 snippets. Add test to verify script injection is blocked. (Critical, Security)
- [x] **Goal 2: Create Action/API Wrapper Functions** — Build `withActionAuth()` and `withApiAuth()` wrappers in `src/lib/action-wrapper.ts`. Centralize CSRF, auth, rate limiting, permissions, error handling. Migrate all server action files to use wrappers. (Medium, DX)
- [x] **Goal 3: Fix Analytics N+1 Queries** — Rewrite `admin/analytics/queries.ts` with JOINs instead of correlated subqueries. Memoize chart components with `React.memo()`. (Medium, Performance)
- [x] **Goal 4: Internationalize Error Messages** — Add error translation keys to EN/RO. Fix 4 missing RO plural forms. Translate 19 untranslated RO keys. Migrate server action error strings to use `t()` where possible. (Medium, UX)
- [x] **Goal 5: Fix Failing Test + Error Logging** — Fix `mail.test.ts` SMTP config test. Add `logger.warn` to webhook `.catch()` handlers. Add `logger.error` to AI suggestion route catch. Wrap `JSON.parse` in rbac.ts. Fix cron auth to use `timingSafeEqual`. (Small, Quality)
- [ ] **Goal 6: Add Onboarding Flow** — Create step-through guide for new users (create project → add proposals → vote). Track completion in user profile. Show on first login. (Medium, UX)
- [ ] **Goal 7: Wire Proposal Tags UI** — Tags schema already exists (`0010_tags.sql`). Add tag selector to proposal form, filter-by-tag on project page, tag management in admin. (Medium, Feature)
- [ ] **Goal 8: Accessibility Polish** — Keyboard-accessible permission badges in role manager. ARIA live regions for dynamic updates. Chart pattern fills for color-blind users. Dialog focus management. (Small, A11y)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
- Run `npm run lint && npx tsc --noEmit && npm test` after each goal to verify nothing breaks.
- Reference: `docs/deep-analysis-sprint42.md` for full details on each issue.
