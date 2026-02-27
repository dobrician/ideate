# Sprint 69 — Analytics Export, Embedding Quality, CI Comparison, E2E Hardening & Notification Preferences

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Workspace analytics CSV/PDF export, embedding similarity quality scoring, CI build branch comparison, E2E test hardening (retry/isolation/parallel), admin notification preferences

## Goals

- [x] **Goal 1: Workspace Analytics Export** — CSV export for search analytics and CI build trends, download endpoints, export buttons on admin pages
- [x] **Goal 2: Embedding Quality Scoring** — Measure embedding similarity accuracy, per-model quality breakdown, scoring dashboard section
- [x] **Goal 3: CI Build Comparison** — Side-by-side build comparison (size, duration, success rate) between branches, comparison API and UI
- [x] **Goal 4: E2E Test Hardening** — Retry logic, rate-limit handling, parallel test execution, improved timeouts
- [x] **Goal 5: Admin Notification Preferences** — Per-user alert preferences for CI, search quality, embedding, and system events with admin UI

## Commits

| Hash | Description |
|------|-------------|
| `e229f8e` | Goal 1 — Workspace analytics CSV export (search analytics + CI builds) |
| `d45918c` | Goal 2 — Embedding quality scoring (self/cross similarity, per-model) |
| `17e925b` | Goal 3 — CI build branch comparison (API + dashboard UI) |
| `ad58b75` | Goal 4 — E2E test hardening (retries, parallel workers, timeouts) |
| `7f6ec73` | Goal 5 — Admin notification preferences (schema, API, UI, tests) |

## New Files

| File | Purpose |
|------|---------|
| `src/lib/analytics-export.ts` | CSV generation for search analytics and CI build data |
| `src/lib/embeddings/quality.ts` | Embedding quality scoring (cosine similarity, grades) |
| `src/lib/ci-build-comparison.ts` | Branch-to-branch build comparison |
| `src/lib/admin-notification-prefs.ts` | Per-user admin alert preference management |
| `src/app/api/admin/export/search-analytics/route.ts` | Search analytics CSV download endpoint |
| `src/app/api/admin/export/ci-builds/route.ts` | CI builds CSV download endpoint |
| `src/app/api/admin/ci-builds/compare/route.ts` | Branch comparison API |
| `src/app/api/admin/notification-prefs/route.ts` | Notification preference GET/POST API |
| `src/app/admin/notification-prefs/page.tsx` | Admin notification preferences UI grid |
| `drizzle/0036_sprint69_admin_alert_categories.sql` | Schema migration — extend category enum |
| `tests/unit/analytics-export.test.ts` | 7 unit tests for CSV export |
| `tests/unit/embedding-quality.test.ts` | 10 unit tests for quality scoring |
| `tests/unit/ci-build-comparison.test.ts` | 9 unit tests for branch comparison |
| `tests/unit/admin-notification-prefs.test.ts` | 8 unit tests for notification prefs |

## Stats

| Metric | Value |
|--------|-------|
| Goals completed | 5/5 |
| Unit tests | 2789 (+34 new) |
| E2E tests | 183 (hardened, no new count) |
| Lint | Pass |
| TypeScript | Pass (0 errors) |
| Build | Pass |

## Sprint Audit

### Architecture
- CSV export follows existing admin API pattern (auth + rate-limit + param validation)
- Embedding quality uses cosine similarity with composite scoring (40% self-similarity + 40% separation + 20% coverage)
- CI comparison API cleanly separates stats computation from comparison logic
- Notification preferences extend existing `notificationChannelPrefs` table via enum expansion (migration 0036)
- All new modules follow existing patterns: logger child, try/catch with defaults, Drizzle ORM queries

### Security
- All new API routes require admin auth (`hasPermission(user.role as Role, "user:manage")`)
- Rate limiting on export endpoints (10 req/hr per IP)
- Zod validation on notification preference POST body
- CSV export uses proper field escaping (quotes, commas, newlines) to prevent injection
- No secrets in source

### Performance
- CSV export streams data directly, no intermediate file storage
- Embedding quality sampling limits DB reads (`sampleLimit` param, default 100)
- Branch comparison uses `limit` param to bound query size (default 50)
- Build passes with no new warnings

### Tests / Coverage
- 34 new unit tests: analytics-export (7), embedding-quality (10), ci-build-comparison (9), admin-notification-prefs (8)
- Total: 2789 unit tests (up from 2755)
- E2E helpers hardened: retry logic (3 attempts, exponential backoff), rate-limit awareness
- Playwright config: 2 CI workers, 60s timeout, screenshots on failure, GitHub reporter

### UX / Mobile
- Export buttons use existing shadcn Button component, responsive
- Embedding quality section uses color-coded bars and grade badges
- CI comparison shows diff percentages with color coding (green=faster, red=slower)
- Notification preferences grid is responsive (3-column layout)
- All new UI strings have EN/RO translations

### CI
- All checks pass: TypeScript, lint, build, 2789 unit tests
- Migration 0036 applied successfully in test suite
- No new CI dependencies or workflow changes

## Risks

- **Low:** Embedding quality scoring samples a limited subset; very large datasets may give different scores
- **Low:** CSV export has no pagination; very large datasets could produce large response bodies (mitigated by limit params)
- **Low:** Notification preference enum extension is backward-compatible (existing rows unaffected)

## Post-Release CI Incident (2026-02-27)

All Sprint 69 CI runs failed due to E2E test issues introduced in Goal 4 (E2E Hardening):

1. **Parse error** — `mobile-nav.test.ts` spread `devices["Pixel 5"]` with `defaultBrowserType` inside `test.describe()`, which Playwright forbids. This blocked all 183 E2E tests.
2. **Latent test bugs** — Once the parse error was fixed, 6 additional test issues surfaced: strict mode violations from `.or()` locator patterns, missing `.first()` on multi-match locators, incorrect mobile nav targeting, 40px touch targets in header mobile links, and unreliable click navigation checks.

Fixed in 4 commits (`83883a0`, `5abf80d`, `329af08`, `d120bf8`). Also improved header mobile nav links to 44px for WCAG AAA compliance. CI fully green at run [#22504034441](https://github.com/dobrician/ideate/actions/runs/22504034441).

See Sprint-Log.md for full incident audit and preventive rules.

## Next Priorities

- Interactive CSV/PDF export with date range filters
- Embedding quality trend tracking over time
- CI build comparison alerts (auto-detect regressions between branches)
- E2E test coverage for new admin pages (export, quality, comparison, notification prefs)
- Notification delivery integration (connect preferences to actual email/in-app dispatch)
