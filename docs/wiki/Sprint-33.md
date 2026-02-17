# Sprint 33 — Visual Review v2 Remaining Fixes

**Date:** 2026-02-17
**Source:** Visual review v2 report (docs/visual-review-report-v2.md)
**Focus:** Fix all remaining P0, P1, and P2 issues from v2 review

## Goals

- [x] **Goal 1: Fix duplicate form + discussion on project detail** — A second "Project Discussion" and "New Proposal" form appear below the fold. Desktop shows sidebar form AND bottom form simultaneously. Remove the bottom-of-page duplicate sections. Show sidebar form on desktop only, dialog/sheet on mobile only. Render discussion section once inside the project card. This is the biggest visual issue remaining.

- [x] **Goal 2: Admin panel mobile card layout** — User emails truncated to unreadable fragments on mobile. Implement responsive card layout for mobile: show email prominently, role as badge, hide Name when empty. Add "Show more" to audit log (limit to 5 entries by default). Fix admin search to filter the user table, not the global nav search. Standardize on relative timestamps ("2h ago") in audit log.

- [x] **Goal 3: Mobile navbar tap targets** — 5 icons packed tightly in mobile navbar. Increase spacing between icons to ensure 44px minimum tap targets, OR consolidate language+theme into a settings menu on mobile.

- [x] **Goal 4: Dashboard mobile optimization** — Dashboard is long on mobile. Limit visible items to 3 per section with "Show more" / "View all" links. Add project name context below each voted proposal in "Recent Votes".

- [x] **Goal 5: Auth & form polish** — Center forgot-password card vertically on mobile. Equalize spacing between register form fields. Move "Submit Proposal" button closer to form fields in sidebar (or make full-width). Add `title` attribute with full author name to truncated proposal author text.

- [ ] **Goal 6: 404 page auth redirect fix** — Unauthenticated users hitting a non-existent route get redirected to login instead of seeing 404. Exempt the 404/not-found page from auth redirect in middleware so it renders for everyone.

## Notes

- Visual review v2 report at `docs/visual-review-report-v2.md`
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
