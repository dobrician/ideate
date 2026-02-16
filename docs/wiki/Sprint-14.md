# Sprint 14 — UI Overhaul & Bug Fixes (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**UI Overhaul (from Ciprian's feedback):**
- [x] Remove sidebar entirely, all navigation in top bar (#16, #22)
- [x] Top nav: fixed-width, centered, contains logo, nav links (Dashboard/Projects), search, locale toggle, dark mode toggle, user menu
- [x] Homepage = Dashboard for logged-in users (#17)
- [x] Dark mode as simple toggle button with auto-detect (#18)
- [x] Proposal list as bar chart: vote percentage backgrounds, sorted descending (#20)
- [x] Fix duplicate plus icon on New Proposal button (#21)

**Bug Fixes (from retest report):**
- [x] Fix logout redirect to 0.0.0.0 — use APP_URL (#23)
- [x] Fix PWA banner: show once, remember dismissal in localStorage (#24)
- [x] Fix Romanian typos/diacritics throughout (#25)
- [x] Hide Sign Out from guest/logged-out nav (#26)
- [x] Fix proposal form submit button off-screen (#27)

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push

## Outcomes
- 10 incremental commits, **562 tests**, **32/32 smoke** (12.4s)
- CI green on all commits, wiki auto-updated via git hooks
- Complete UI overhaul: sidebar removed, top nav bar with fixed-width centered layout
- Homepage = Dashboard for logged-in users
- Dark mode: simple toggle with system auto-detect
- Proposal list: bar chart with vote percentage backgrounds, sorted descending
- Logout redirect fixed (APP_URL)
- PWA banner: localStorage persistence, shows once
- Romanian diacritics audit and fix
- Guest nav cleaned (no Sign Out)

## Notes
- First sprint with post-commit hook auto-checking goals — worked perfectly
- All GitHub issues (#16-27) addressed and can be closed
