# Sprint 39 — Code Quality, Coverage Gaps & Accessibility

**Date:** 2026-02-17
**Focus:** Fix lint warnings, close coverage gaps (search-d1/actions/db), split oversized files, remove dead code, localize export dates, proposal form a11y

## Goals

- [x] **Goal 1: Fix proposal-form.tsx lint warnings** — Fix 2 `react-hooks/exhaustive-deps` warnings (useEffect missing `form` dependency at lines 192/228). Only lint issues in the codebase.

- [x] **Goal 2: Test coverage for `search-d1.ts`** — Close coverage gap (87.5% stmts, 53.8% branch). Test D1 search adapter fallback paths and proposal mapping.

- [x] **Goal 3: Test coverage for `projects/actions.ts`** — Improve branch (87%) and function (71%) coverage. Test edge cases: validation failures, permission denials, archive-state checks.

- [ ] **Goal 4: Split oversized files** — Split files exceeding 300 lines: comment-thread.tsx (433), export.ts (424), admin/actions.ts (408), admin/user-role-manager.tsx (407), suggest-proposals.tsx (316), proposal-list.tsx (308).

- [ ] **Goal 5: Remove dead `generateReportHtml`** — Remove unused `generateReportHtml` export from `lib/export.ts` and its associated dead code.

- [ ] **Goal 6: Localize export date formatting** — Replace 3 hardcoded `"en-US"` locale strings in `lib/export.ts` with user locale support.

- [ ] **Goal 7: Wire `aria-describedby` on proposal form** — Connect error messages to description field via `aria-describedby`. Fix WCAG A.11 compliance gap.

- [ ] **Goal 8: Test coverage for `db/index.ts`** — Close branch gap (83.33%). Test migration error handling and D1 adapter code paths.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
