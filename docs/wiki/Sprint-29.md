# Sprint 29 — UI/UX Polish (ChatGPT Review Fixes)

**Date:** 2026-02-17
**Source:** External UI/UX review (docs/ui-ux-review-chatgpt.md)
**Focus:** Fix all critical and major UX issues identified in the review

## Goals

- [x] **Goal 1: Proposal submission feedback** — Add toast notification + form reset on successful proposal creation; show inline error on failure. User must have zero doubt whether it worked.

- [x] **Goal 2: Fix export (PDF/CSV)** — PDF export must produce actual PDF (use server-side HTML→PDF or rename to HTML export); CSV export must produce valid CSV. Verify downloaded file types match button labels.

- [x] **Goal 3: Styled form validation across all forms** — Replace browser-default validation tooltips with styled inline error messages on: login, registration, forgot password, create project, create proposal, comments. Include: required fields, email format, password mismatch, min length. Fix the "Creeează" typo → "Creează".

- [x] **Goal 4: Auth flow error feedback** — Login: show styled error for wrong credentials. Registration: show error if email exists, success message + redirect on creation. Forgot password: show confirmation message regardless of email existence (security). All auth forms must have visible feedback for every outcome.

- [x] **Goal 5: Admin panel UX** — Add toast confirmation when role is changed. Add search/filter to user table. Add pagination (or virtual scroll) if >20 users.

- [x] **Goal 6: i18n consistency** — Audit all user-facing strings. Fix mixed ro/en labels (e.g., "Joined at" in profile, "Proiectele Mele X din Y total"). Ensure consistent language throughout. Fix "chiar acum Tu" → proper Romanian phrasing.

- [ ] **Goal 7: Mobile & responsive fixes** — PWA install banner must not overlap content (reposition or make dismissible). AI suggestions modal must be scrollable and fit small screens. Test all modals/dialogs on mobile viewports.

- [ ] **Goal 8: Projects list UX** — Add search bar, sorting (by date, name, status), and filtering (by status). Add pagination or infinite scroll for >10 projects.

## Notes

- Review report at `docs/ui-ux-review-chatgpt.md`
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
