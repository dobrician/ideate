# Sprint 32 — Visual Review P1+P2 Fixes

**Date:** 2026-02-17
**Source:** Automated visual review report (docs/visual-review-report.md, 56 screenshots)
**Focus:** Fix all P1 (ugly/broken) and P2 (polish) issues from visual review

## Goals

- [x] **Goal 1: Dark mode primary button contrast** — Primary CTA buttons on auth pages (Login, Register, Forgot Password) are nearly invisible in dark mode. Change primary button variant in dark mode to use brand color (green/teal) fill or add visible border. Also fix outline buttons being too faint in dark mode. Files: `src/components/ui/button.tsx`, Tailwind theme config, globals.css.

- [x] **Goal 2: Fix duplicate proposal form on desktop** — On project detail page, sidebar form AND bottom full-width form are both visible simultaneously on desktop. Show only the sidebar form on desktop. Hide the bottom form when sidebar is visible. Files: `src/app/projects/[id]/page.tsx`, proposal form components.

- [x] **Goal 3: Profile page restructure with tabs** — Profile page is too long (5 sections stacked). Split into tabbed sections: Account, Security, My Projects, My Proposals. Use shadcn/ui Tabs component. Add "Show more" with default limit of 3-5 items for project/proposal lists. File: `src/app/profile/page.tsx`.

- [ ] **Goal 4: Admin panel mobile responsiveness** — User table is illegible on mobile (truncated emails, "--" for names). Use responsive card layout for mobile showing Email prominently, Role as badge, hide Name when empty. Show "Not set" in muted text instead of "--". Audit log entries: use relative timestamps ("2h ago"), truncate descriptions with expand. File: `src/app/admin/page.tsx`, `src/app/admin/user-role-manager.tsx`.

- [ ] **Goal 5: Navbar and form consistency** — Increase spacing between navbar icons for 44px minimum tap targets on mobile. Standardize all form inputs to bordered box style (not underline). Apply consistent `truncate` + `text-overflow: ellipsis` + `title` attributes on all project/proposal name displays. Add "Ideate" brand text to forgot-password card header for consistency with login/register.

- [ ] **Goal 6: Project detail UX fixes** — Fix vote bar fill to match actual pro/(pro+contra) ratio. Make AI suggestions modal slightly larger on desktop + add skeleton loading state. Move Submit Proposal button closer to form fields in sidebar. Add dark mode border to create-project card for definition.

- [ ] **Goal 7: Layout polish** — Center bottom row of feature cards on home page (desktop). Center forgot-password card vertically on mobile instead of pushing to lower half. Set min-height on project cards for consistent height on desktop. Fix admin search to filter the user table, not the global nav search. Add "Showing X-Y of Z projects" text near pagination.

- [ ] **Goal 8: P3 quick wins** — Add avatar/initials circle to Profile account section. Show "30 days left" instead of "29d 23:59:30 remaining" on project countdown. Make admin stat cards link to filtered views. Add `title="Send comment"` tooltip to comment send button. Make "Go Home" a filled primary button on 404 page, "View Projects" as outline.

## Notes

- Full visual review report at `docs/visual-review-report.md`
- 56 screenshots at `tests/visual-review/screenshots/`
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
