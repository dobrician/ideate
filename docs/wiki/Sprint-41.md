# Sprint 41 — Code Quality, Dead Code Removal & Accessibility Polish

**Date:** 2026-02-17
**Focus:** Inline lone query, locale fallback fix, role=alert on error containers, rename buildCommentTree, remove re-export shim, remove dead sanitize exports, locale export test, dead code audit

## Goals

- [x] **Goal 1: Inline getProjectComments and remove db/queries.ts** — `db/queries.ts` is a lone outlier with a single function while all other queries are page-local. Move the query inline to its sole caller (`projects/[id]/page.tsx`) and delete the file.

- [x] **Goal 2: Replace hardcoded "en-US" fallback in export formatDate** — `lib/export-types.ts` uses `locale ?? "en-US"`. Fall back to `process.env.LOCALE || "en-US"` to match the locale strategy used in `lib/ai.ts`.

- [x] **Goal 3: Add role="alert" to remaining dynamic error containers** — `reset-password`, `forgot-password`, `projects/new`, `edit-project-dialog`, and `suggest-proposals` have dynamic error divs without `role="alert"`. Add it for screen reader announcements.

- [x] **Goal 4: Rename buildCommentTree to buildThreadedCommentTree** — The function in `lib/comment-utils.ts` sorts then builds a parent-child tree. Rename to `buildThreadedCommentTree` for clarity. Update all import sites.

- [x] **Goal 5: Remove re-export shim from comment-thread.tsx** — Lines 17-19 re-export `buildCommentTree`, `formatTimeAgo`, `getInitials`, `avatarColor` and types from `comment-utils`. Migrate the one external importer (`proposal-item.tsx`) to import directly from `lib/comment-utils`, then remove the shim.

- [x] **Goal 6: Remove unused stripHtml and sanitizeInput from sanitize.ts** — These functions are exported but never imported in production code (only in tests). Remove them and their tests.

- [ ] **Goal 7: Add test verifying export formatDate respects non-English locale** — Add a unit test that calls `formatDate` with a Romanian locale and asserts month names are in Romanian, confirming the locale parameter works end-to-end.

- [ ] **Goal 8: Verify generateReportHtml is removed and close dead code audit** — The deep analysis flagged `generateReportHtml` in `export.ts` as potentially dead. Confirm it no longer exists after the export refactor and document closure in this sprint.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
