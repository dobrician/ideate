# Sprint 23 Dashboard Analysis (Codex)

Date: 2026-02-16
Analyst: Codex
Constraint honored: `docs/sprint23-analysis-claude.md` was not read.

## Scope and Method
- Reviewed dashboard-related source in Ideate across pages, layouts, components, styles, API routes, and tests.
- Traced dependencies from `src/app/dashboard/page.tsx` into auth, i18n, query, and shell/navigation layers.
- Compared against dashboard implementation patterns in `/home/dc/work/ideator`.
- Ran live checks with `curl` against `https://idea.surmont.co/`.

## Current Dashboard-Related Files

### Pages / Layout / Styles
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/queries.ts`
- `src/app/dashboard/loading.tsx`
- `src/app/dashboard/error.tsx`
- `src/app/layout.tsx`
- `src/components/app-shell.tsx`
- `src/app/globals.css`

### Components (Direct + Shell)
- `src/components/stat-card.tsx`
- `src/components/header.tsx`
- `src/components/search-bar.tsx`
- `src/components/dark-mode-toggle.tsx`
- `src/components/locale-switcher.tsx`
- `src/components/theme-provider.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/dropdown-menu.tsx`

### API Routes / Runtime Dependencies
- `src/app/api/me/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/health/route.ts`
- `src/lib/auth.ts`
- `src/lib/search.ts`
- `src/lib/i18n.ts`
- `src/lib/i18n-server.ts`
- `src/lib/use-locale.ts`
- `src/lib/status-utils.ts`
- `src/lib/translations/en.ts`
- `src/lib/translations/ro.ts`
- `src/db/schema.ts`
- `src/middleware.ts`

### Tests Covering Dashboard Behavior (Direct/Indirect)
- `tests/e2e/auth.test.ts`
- `tests/e2e/navigation.test.ts`
- `tests/e2e/helpers.ts`
- `tests/e2e/api.test.ts`
- `tests/unit/header.dom.test.tsx`
- `tests/unit/stat-card.test.ts`
- `tests/unit/i18n.test.ts`
- `tests/unit/api-search.test.ts`
- `tests/unit/middleware.test.ts`

## Per-File Assessment

- `src/app/dashboard/page.tsx`
  - Good: clean server component, auth gate, i18n usage, clear empty states, good ARIA labeling.
  - Risk: project fallback label uses hardcoded English (`"Unknown project"`) in localized UI.
  - Risk: activity links use `a.projectId` from left-joined data; null path can render as `/projects/null`.

- `src/app/dashboard/queries.ts`
  - Good: parallel fetch structure (`Promise.all`) and practical limits.
  - Risk: activity feed is global (all comments), not scoped to current user or user-visible projects; likely noisy/privacy-sensitive.
  - Risk: embedded SQL snippets for counts (`sql\`(SELECT COUNT...)\``) conflict with project rule intent of avoiding raw SQL outside migrations.

- `src/app/dashboard/loading.tsx`
  - Good: present and aligned with actual dashboard structure.
  - Minor: no semantic loading region/announcement for assistive tech.

- `src/app/dashboard/error.tsx`
  - Good: route-level error boundary exists with retry path.
  - Risk: shows raw `error.message` to users, which can leak internals.

- `src/components/stat-card.tsx`
  - Good: reusable and accessible label (`aria-label` includes metric context).
  - Minor: `icon` prop is mandatory though some callers may not need it.

- `src/components/header.tsx`
  - Good: desktop and mobile nav, locale/theme/profile controls, admin-aware link inclusion.
  - Risk: dashboard shell always triggers client fetch to `/api/me` on mount; extra round-trip and potential UI flicker.

- `src/components/search-bar.tsx`
  - Good: debounce, auth-protected backend, result dropdown.
  - Risk: keyboard UX is limited (no arrow navigation/select). On mobile it is hidden due to header layout.

- `src/components/app-shell.tsx`
  - Good: auth pages exclude app header cleanly.
  - Risk: no route-group layout for dashboard-specific shell variants (limits redesign flexibility).

- `src/app/layout.tsx` + `src/app/globals.css`
  - Good: stable app-wide composition and tokenized theme variables.
  - Risk: `themeColor` is fixed blue (`#0070f3`), visually off from neutral palette and brand direction.

- `src/app/api/me/route.ts`
  - Good: minimal payload and proper 401 behavior.
  - Minor: no caching hints; endpoint is called by header on every load.

- `src/app/api/search/route.ts` + `src/lib/search.ts`
  - Good: auth guard, short-query guard, capped limit.
  - Risk: negative `limit` currently flows through (`Math.min(limit, 50)`); tests confirm this behavior.

- `src/middleware.ts`
  - Good: protects `/dashboard` and preserves redirect target.
  - Risk: `/api/search` and `/api/me` are in public paths and rely on handler-level auth; acceptable but less strict than middleware-level protection.

- `tests/*` set listed above
  - Good: route protection and shell/header behavior are tested.
  - Major gap: no direct dashboard page rendering test for authenticated users, no unit tests for `getDashboardData`, no tests for `dashboard/error.tsx` and `dashboard/loading.tsx` behavior.

## Live Test Results (curl)

Test time window: 2026-02-16 20:25:47 to 20:26:08 UTC (from response headers).

- `GET https://idea.surmont.co/`
  - Status: `200`
  - Content-Type: `text/html; charset=utf-8`
  - Size/time: `38507` bytes, `~0.095s`
  - Observed: homepage HTML includes header nav, search input markup, `Dashboard` link, and expected landing content.

- `GET https://idea.surmont.co/dashboard`
  - Status: `307`
  - Redirect: `/auth/login?redirect=%2Fdashboard`
  - Followed (`-L`): lands on login page (`200`) with sign-in form content.

- `GET https://idea.surmont.co/api/health`
  - Status: `200`
  - Body: `{\"status\":\"healthy\",\"timestamp\":\"2026-02-16T20:25:47.792Z\",\"database\":\"ok\",\"version\":\"0.1.0\"}`

- `GET https://idea.surmont.co/api/me` (unauthenticated)
  - Status: `401`
  - Body: `{\"error\":\"Unauthorized\"}`

- `GET https://idea.surmont.co/api/search?q=dashboard` (unauthenticated)
  - Status: `401`
  - Body: `{\"error\":\"Unauthorized\"}`

- Static assets from homepage HTML:
  - `/_next/static/chunks/8c6379aad872347a.css` -> `200`
  - `/_next/static/chunks/804c1ad83d5bb653.js` -> `200`

## Ideator Comparison: Features Worth Porting

Reference files:
- `/home/dc/work/ideator/app/(app)/dashboard/page.tsx`
- `/home/dc/work/ideator/app/(app)/layout.tsx`
- `/home/dc/work/ideator/src/components/site-header.tsx`
- `/home/dc/work/ideator/src/components/main-nav.tsx`
- `/home/dc/work/ideator/tests/dashboard.spec.ts`

Worth porting into Sprint 23 redesign:
- Dashboard as project-centric card grid (deadline-first ordering) with at-a-glance metrics per project (proposals/upvotes/downvotes/comments).
- Strong top-of-page primary CTA (`New Project`) inside dashboard context.
- Richer card content hierarchy: title, deadline recency, summary preview, compact metric strip.
- More prominent visual affordances (hover elevation, denser information per viewport).

Not worth porting as-is:
- Ideator’s dashboard test is weak/skippable under redirect conditions.
- Several nav targets in Ideator (`/projects/my`, `/contributions`) are placeholders/stubs.

## Mobile Concerns
- Dashboard currently stacks into long single-column cards with four major sections; high scroll cost before key actions (`src/app/dashboard/page.tsx`).
- Global search is hidden on mobile (`md:flex` in `src/components/header.tsx`), reducing discoverability and parity.
- Mobile nav has only route chips and no overflow strategy for future items (admin/sprint additions).
- Activity items use `line-clamp-1`; useful context is frequently truncated on narrow screens.

## Prioritized Fix List

1. P0: Scope dashboard activity feed to relevant data.
- File: `src/app/dashboard/queries.ts`
- Change: filter recent activity to user-related projects/proposals or team-visible scope; avoid global comment firehose.

2. P0: Add real dashboard tests (authenticated render + data query).
- Files: `tests/e2e/*`, `tests/unit/*` (new dashboard-focused specs)
- Change: cover loaded state, empty state, populated state, error state, and `getDashboardData` correctness.

3. P1: Remove potential internal error leakage.
- File: `src/app/dashboard/error.tsx`
- Change: replace raw `error.message` display with safe localized generic message + optional correlation id.

4. P1: Harden query edge cases.
- File: `src/app/dashboard/page.tsx`, `src/app/dashboard/queries.ts`
- Change: guard null `projectId` links in activity rows; localize fallback labels.

5. P1: Improve mobile dashboard usability.
- Files: `src/app/dashboard/page.tsx`, `src/components/header.tsx`
- Change: surface mobile search entry point; reduce above-the-fold scroll cost; adjust activity truncation strategy.

6. P2: Align with architecture rule on SQL style.
- File: `src/app/dashboard/queries.ts`
- Change: replace raw SQL count subqueries with Drizzle-native aggregations/queries for consistency.

7. P2: Tighten search API parameter validation.
- File: `src/app/api/search/route.ts`
- Change: clamp lower bound (`limit >= 1`) and normalize invalid numeric inputs.

