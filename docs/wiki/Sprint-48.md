# Sprint 48 — Realistic Data Factories & High-Volume Simulation

**Date:** 2026-02-19
**Focus:** Build factory system to generate realistic, AI-quality sample data simulating 20+ users with diverse votes, proposals, and comments across multiple projects.

## Goals

- [x] Create `src/lib/factories/` module with factories for: users, projects, proposals, votes, comments, tags
- [x] Factory users: 20 realistic personas (Romanian + international names, real-looking emails, varied roles)
- [x] Factory projects: 5-8 realistic project scenarios (product launches, office redesign, team retreats, budget allocation, tech stack migration, etc.)
- [x] Factory proposals: 3-8 proposals per project, realistic content as if written by real people with different writing styles and perspectives
- [x] Factory votes: Realistic voting patterns (not uniform — some proposals controversial, some unanimous, some polarizing)
- [x] Factory comments: Threaded discussions with realistic back-and-forth, agreements, disagreements, questions, suggestions
- [x] Factory tags: Realistic tag taxonomy (priority, category, department tags)
- [x] Create `scripts/seed-demo.ts` — CLI script that runs all factories and populates DB with full demo dataset
- [x] Create `src/app/api/admin/seed-demo/route.ts` — admin-only API endpoint to trigger seeding (with option to clean first)
- [x] Add npm script: `npm run seed:demo` to run the CLI seeder
- [x] All generated content should feel like it was written by real people in a real company — varied tone, different levels of detail, occasional typos or casual language
- [x] Ensure factories are reusable and composable (can generate N users, M projects, etc.)
- [x] Add tests for factories (they produce valid data, relationships are correct)

## Dashboard Production-Readiness Improvements

UX review scored the dashboard 5.5/10. The following improvements were made to bring it to production quality:

- [x] **i18n: Fix Romanian Mele/Tale inconsistency** — Stat labels said "Mele" (My) but card headers said "Tale" (Your). Normalized everything to 1st-person "Mele"/"My" across RO and EN translations. Also translated `nav.dashboard` and `dashboard.title` to Romanian ("Panou"/"Panou de Control").
- [x] **a11y: Colorblind-accessible chart patterns** — Dashboard charts relied solely on red/green to distinguish pro/contra (unusable for ~8% of men). Ported SVG pattern fills from admin analytics charts: dot overlay for pro, cross-hatch for contra, grid for activity. Added `strokeDasharray` on contra line for shape distinction.
- [x] **a11y: Tooltips on all truncated text** — Added `title` attributes to every truncated element: mobile stat pill labels, vote proposal/project titles, activity feed headlines, and comment previews. Users can now hover to see full text.
- [x] **a11y: CollapsibleList `aria-expanded`** — Added missing `aria-expanded` attribute to the show more/less toggle button so screen readers announce the open/closed state.
- [x] **ui: Dashboard layout balance** — Equalized card heights in 2-col grid using flex layout. Added `max-h-80` with `overflow-y-auto` to all list cards for consistent heights. Added `<hr>` separator before analytics and wrapped analytics in `<section>` with `aria-labelledby`.
- [x] **ui: Theme-aware chart tooltips and axes** — Chart tooltips now use CSS variables (`--color-card`, `--color-border`, `--color-card-foreground`) for proper dark mode support. Axis tick labels use `--color-muted-foreground` instead of hardcoded black.
