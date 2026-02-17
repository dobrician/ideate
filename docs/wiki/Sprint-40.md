# Sprint 40 — Security Hardening, Accessibility & Tech Debt

**Date:** 2026-02-17
**Focus:** Account takeover fix, JWT revocation, auth logging, error text contrast, vote icon a11y, dialog focus, rate limiting, schema+hook cleanup

## Goals

- [x] **Goal 1: Fix account takeover in registerUser** — `password.ts:98-108` allows setting a password on a magic-link-only account without ownership proof. Require active session or email re-verification before adding a password.

- [x] **Goal 2: Add JWT revocation blocklist** — `jti` field is generated but never checked. Add a `revokedTokens` table and check `jti` on every auth call. Logout inserts `jti` into blocklist.

- [ ] **Goal 3: Add auth error logging** — `auth.ts` lines 90 and 177 silently catch JWT verification errors. Add structured pino logging to both catch blocks.

- [ ] **Goal 4: Fix error text WCAG AA contrast** — `text-red-600` on white fails AA for small text (~3.9:1). Switch to `text-red-700 dark:text-red-400` across all form error messages.

- [ ] **Goal 5: Add sr-only text to dashboard vote icons** — ThumbsUp/ThumbsDown icons in dashboard recent votes convey direction by color only. Add `<span className="sr-only">` labels.

- [ ] **Goal 6: Fix nested AI dialog focus leakage** — Nested `<Dialog>` in suggest-proposals.tsx allows focus leakage between outer suggestion dialog and inner detail dialog. Replace inner dialog with inline expand or sheet.

- [ ] **Goal 7: Add rate limiting to non-auth API routes** — Proposals, votes, search, and AI endpoints have no rate limiting. Add per-IP rate limits to these routes.

- [ ] **Goal 8: Move use-proposal-form.ts to lib + add users.id defaultFn** — Move hook from `components/` to `lib/`. Add `$defaultFn(() => randomUUID())` to `users.id` in schema for consistency with all other tables.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
