# Sprint 30 — Security & Accessibility Hardening

**Date:** 2026-02-17
**Source:** Deep analysis report (docs/deep-analysis-report.md)
**Focus:** Fix all HIGH/MEDIUM security issues, critical accessibility gaps, and code quality deduplication

## Goals

- [x] **Goal 1: Fix open redirect vulnerability** — In `login/page.tsx`, validate that `redirect` param starts with `/` and doesn't contain `//`. Reject or strip anything else. Add unit test for open redirect attack vectors.

- [x] **Goal 2: Zod validation on AI endpoints** — Add proper Zod schema validation to `api/proposals/suggest/route.ts` and `api/proposals/similarity/route.ts`. Validate input types, enforce max array lengths, reject oversized payloads. Add tests.

- [x] **Goal 3: Add HSTS header** — Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` in middleware security headers.

- [x] **Goal 4: Fix middleware dot-check bypass** — Replace `pathname.includes(".")` with a check for specific static file extensions (`.css`, `.js`, `.ico`, `.png`, `.jpg`, `.svg`, `.woff`, `.woff2`). Add test for the bypass scenario.

- [ ] **Goal 5: Accessibility critical fixes** — Add skip-to-main-content link + `id="main-content"` on `<main>`. Fix heading hierarchy (h1 on home, login, register pages). Replace `title` with `aria-label` on all icon-only buttons. Add `aria-label` to unlabeled `<select>` elements. Add `role="alert"` to error message containers. Wire `aria-describedby` on proposal form errors.

- [ ] **Goal 6: Code quality deduplication** — Extract shared `isDeadlinePassed` to `lib/project-utils.ts`. Remove duplicate `escapeHtml` from `export.ts` (import from `sanitize.ts`). Extract duplicate `Comment` type to shared types. Remove verified unused exports from rbac, sanitize, ai, llm modules (verify they're truly unused first).

- [ ] **Goal 7: DB indexes & schema fixes** — Add indexes on `proposals.projectId`, `comments.projectId`, `comments.proposalId`, `comments.parentId`. Add foreign key on `comments.parentId`. Add `updatedAt` to votes table. Generate and run migration.

- [ ] **Goal 8: Change password in profile** — Add a "Change Password" section to the profile page. Require current password verification. Validate new password strength. Show toast on success. Add tests.

## Notes

- Analysis report at `docs/deep-analysis-report.md`
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
