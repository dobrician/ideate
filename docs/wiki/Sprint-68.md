# Sprint 68 — Search Analytics Dashboard, Embedding Model Upgrades, CI Alerting, E2E & Performance Profiling

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Search feedback analytics dashboard, embedding model migration path, CI build alerting with notifications, E2E expansion (search/embedding/mobile), performance profiling and bundle tracking

## Goals

- [x] **Goal 1: Search Feedback Analytics Dashboard** — Quality scores by mode, feedback trend timeline, low-rated results table, summary cards on `/admin/search-analytics/`
- [x] **Goal 2: Embedding Model Upgrade Path** — Model migration with `migrateEmbeddingModel()`, distribution stats, admin UI for migration status, batch re-embedding via stale-refresh
- [x] **Goal 3: CI Build Alerting** — Failure streak detection, duration regression alerts, configurable thresholds, dispatch via integration dispatcher (Slack/Teams/Discord)
- [x] **Goal 4: E2E Test Expansion** — Search feedback analytics (6), embedding admin interactions (6), mobile navigation (6) = 18 new E2E tests
- [x] **Goal 5: Performance Profiling & Bundle Tracking** — Bundle size history, performance budgets (env-configurable), trend detection, regression alerts on perf dashboard

## Commits

| Hash | Description |
|------|-------------|
| `b7ee467` | feat(search): Sprint 68 Goal 1 — search feedback analytics dashboard |
| `938b35c` | feat(embeddings): Sprint 68 Goal 2 — embedding model upgrade path |
| `8836e91` | feat(ci): Sprint 68 Goal 3 — CI build alerting |
| `0e9ccaf` | test(e2e): Sprint 68 Goal 4 — E2E test expansion |
| `f2fbd84` | feat(perf): Sprint 68 Goal 5 — performance profiling & bundle tracking |

## Stats

| Metric | Value |
|--------|-------|
| Goals completed | 5/5 |
| Unit tests | 2755 (+40 from 2715) |
| E2E tests | 183 (+18 from 165) |
| Lint | Clean |
| TypeScript | Clean |
| Build | Clean |

## What Was Built

### Goal 1: Search Feedback Analytics Dashboard
- Added `getSearchFeedbackTrend()` — daily aggregation of positive/negative feedback over configurable window
- Added `getLowRatedResults()` — joins feedback with analytics to surface poorly-rated search results
- Updated barrel export in `src/lib/search/index.ts`
- Enhanced `/admin/search-analytics/` with: quality-by-mode progress bars, feedback trend timeline, low-rated results table, summary cards (total feedback, positive rate)
- EN/RO translations for all new UI strings
- 7 new unit tests in `tests/unit/search-quality.test.ts`

### Goal 2: Embedding Model Upgrade Path
- Added `getModelDistribution()` — percentage breakdown of embeddings by model
- Added `migrateEmbeddingModel()` — marks off-target embeddings as stale (epoch updatedAt) for cron pickup
- Added `getEmbeddingMigrationStatus()` — progress tracking (on-target, off-target, percentage)
- Created API at `/api/admin/embeddings/` — GET (status + distribution), POST (trigger migration, Zod-validated)
- Enhanced `/admin/embeddings/` page with migration status section, progress bar, distribution breakdown
- EN/RO translations
- 9 new unit tests in `tests/unit/embedding-migration.test.ts`

### Goal 3: CI Build Alerting
- Added `getCiAlertThreshold()` — env-configurable (`CI_ALERT_THRESHOLD`, default 3, range 2-20)
- Added `checkCiBuildAlerts()` — detects failure streaks and duration regressions (>20% slower than baseline)
- Added `getCiBuildAlertSummary()` — combines failure stats, trend, and current alert
- Updated cron route to check alerts and dispatch via `dispatchToIntegrations("ci.alert", ...)`
- Enhanced perf dashboard with alert banners
- EN/RO translations
- 11 new unit tests in `tests/unit/ci-build-alerts.test.ts`

### Goal 4: E2E Test Expansion
- `tests/e2e/search-feedback.test.ts` — 6 tests: page load, quality by mode, feedback trend, low-rated results, summary cards, non-admin access denied
- `tests/e2e/embedding-admin.test.ts` — 6 tests: migration section, progress display, coverage bars, API status, auth check, model info
- `tests/e2e/mobile-nav.test.ts` — 6 tests: mobile nav visible, link navigation, 44px touch targets, admin mobile, search analytics responsive, embeddings responsive

### Goal 5: Performance Profiling & Bundle Tracking
- Created `src/lib/bundle-tracker.ts` with: `getPerfBudget()` (env-configurable size/duration/regression limits), `getBundleSizeHistory()`, `getBundleSizeAnalytics()` (trend detection: growing/shrinking/stable), `checkBundleSizeRegression()` (percentage-based detection)
- Enhanced perf dashboard with bundle tracking section: size/duration budget bars, trend indicator, regression warnings
- EN/RO translations
- 13 new unit tests in `tests/unit/bundle-tracker.test.ts`

## Sprint Audit

### Architecture
- All new modules follow established patterns: logger.child(), graceful error handling, env-configurable defaults
- Bundle tracker reads from existing `ciBuilds` table — no new migrations needed
- Embedding migration leverages existing stale-refresh cron mechanism (sets updatedAt to epoch)
- CI alerting integrates with existing integration dispatcher for notifications
- Search feedback analytics builds on Sprint 67's `searchFeedback` table and `searchAnalytics` join

### Security
- Admin-only endpoints check `hasPermission(user.role as Role, "user:manage")`
- Embedding migration API validates `targetModel` with Zod schema
- No new secrets introduced; CI alert threshold and perf budgets are non-sensitive env vars
- No raw SQL — all queries through Drizzle ORM
- No user input rendered without sanitization

### Performance
- Bundle tracker queries use `orderBy` + `limit` for bounded result sets
- Feedback trend uses SQL `DATE()` aggregation — computation in database, not application
- Alert checks run in cron (not per-request) — zero impact on user-facing latency
- All new admin page sections are server-rendered (no client-side data fetching)

### Tests & Coverage
- Unit: 2755 total (+40 new across 4 test files)
- E2E: 183 total (+18 new across 3 test files)
- All new functions have dedicated test coverage
- Error paths tested (db errors return safe defaults)
- Edge cases: invalid env vars, empty datasets, single entries, boundary values

### UX & Mobile
- All new admin sections use existing responsive card/table patterns
- Mobile nav E2E tests verify 44px touch targets
- Search analytics responsive test confirms no horizontal overflow on Pixel 5 viewport
- Embeddings admin responsive test confirms page loads without horizontal scroll

### CI
- Lint: Clean
- TypeScript: Clean (strict mode)
- Build: Clean
- All 2755 unit tests passing (188 test files)
- No new CI configuration changes

## Risks

- **Low:** Embedding migration via epoch-updatedAt is a soft approach; if cron interval is long, migration could take time for large datasets. Mitigation: cron runs frequently, processes in batches.
- **Low:** Bundle tracker relies on `ciBuilds` table having `buildSizeBytes` populated. If CI doesn't report sizes, analytics will show no data. Mitigation: graceful "no data" handling with null checks.
- **Low:** CI alert threshold defaults to 3 consecutive failures. Noisy CI could trigger false alerts. Mitigation: configurable via `CI_ALERT_THRESHOLD` env var.

## Next Sprint Priorities

1. **Workspace analytics export** — CSV/PDF export for search analytics and CI build trends
2. **Embedding quality scoring** — Measure embedding similarity accuracy and track quality over time
3. **CI build comparison** — Side-by-side build comparison (size, duration, test count) between branches
4. **E2E test hardening** — Retry logic, better seed isolation, parallel test execution
5. **Admin notification preferences** — Per-user alert preferences for CI, search quality, and system events
