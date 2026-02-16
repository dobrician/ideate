# Sprint 14 — UI Overhaul & Bug Fixes (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**UI Overhaul (from Ciprian's feedback):**
- [x] Remove sidebar entirely, all navigation in top bar (#16, #22)
- [x] Top nav: fixed-width, centered, contains logo, nav links (Dashboard/Projects), search, locale toggle, dark mode toggle, user menu
- [x] Homepage = Dashboard for logged-in users (#17)
- [x] Dark mode as simple toggle button with auto-detect (#18)
- [ ] Proposal list as bar chart: vote percentage backgrounds, sorted descending (#20)
- [ ] Fix duplicate plus icon on New Proposal button (#21)

**Bug Fixes (from retest report):**
- [ ] Fix logout redirect to 0.0.0.0 — use APP_URL (#23)
- [ ] Fix PWA banner: show once, remember dismissal in localStorage (#24)
- [ ] Fix Romanian typos/diacritics throughout (#25)
- [ ] Hide Sign Out from guest/logged-out nav (#26)
- [ ] Fix proposal form submit button off-screen (#27)

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
