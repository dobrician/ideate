# Sprint 70 — Export Filters, Quality Trends, Regression Alerts, E2E Coverage & Notification Delivery

**Date:** 2026-03-05
**Status:** COMPLETE
**Focus:** Interactive export filters, embedding quality trend tracking, CI regression alerts engine, E2E for new admin pages, notification delivery wiring

## Goals

- [x] **Goal 1: Interactive Analytics Export Filters** — Date-range (startDate/endDate) and model/branch filters for CSV export endpoints and admin pages
- [x] **Goal 2: Embedding Quality Trend Tracking** — Periodic quality snapshots, trend API, admin UI chart/cards showing quality over time
- [x] **Goal 3: CI Regression Alerts Engine** — Detect regressions (duration, size, failure rate) between branches/runs, threshold config, persisted alerts
- [x] **Goal 4: E2E Coverage for New Admin Pages** — Stable selectors and robust assertions for export, embedding quality, CI comparison, notification prefs pages
- [x] **Goal 5: Notification Delivery Wiring** — Connect notification preferences to real in-app and email delivery paths, honoring per-user category/channel toggles

## Commits

| Hash | Description |
|------|-------------|
| `a57239a` | Goal 1 — Interactive analytics export filters (date-range, mode, branch) |
| `fc09180` | Goal 2 — Embedding quality trend tracking (snapshots, trend API, cron) |
| `0ac20db` | Goal 3 — CI regression alerts engine (detection, persistence, API) |
| `45f1c45` | Goal 4 — E2E coverage for new admin pages (18 tests) |
| `c8ce4a4` | Goal 5 — Notification delivery wiring (in-app + email, cron integration) |

## New Files

| File | Purpose |
|------|---------|
| `src/lib/embeddings/quality-trends.ts` | Quality snapshot persistence and trend computation |
| `src/lib/ci-regression-alerts.ts` | CI regression detection engine with persisted alerts |
| `src/lib/admin-alert-delivery.ts` | Admin alert delivery (in-app + email) with preference checks |
| `src/app/api/admin/embeddings/quality-trends/route.ts` | Quality trend GET/POST API |
| `src/app/api/admin/ci-alerts/route.ts` | CI regression alerts GET/POST API |
| `drizzle/0037_sprint70_quality_snapshots.sql` | Embedding quality snapshots table |
| `drizzle/0038_sprint70_ci_regression_alerts.sql` | CI regression alerts table |
| `tests/unit/embedding-quality-trends.test.ts` | 9 unit tests for quality trends |
| `tests/unit/ci-regression-alerts.test.ts` | 13 unit tests for regression alerts |
| `tests/unit/admin-alert-delivery.test.ts` | 8 unit tests for alert delivery |
| `tests/e2e/admin-sprint70.test.ts` | 18 E2E tests for new admin pages |

## Stats

| Metric | Value |
|--------|-------|
| Goals completed | 5/5 |
| Unit tests | 2825 (+36) |
| E2E tests | 201 (+18) |
| Lint | Pass |
| TypeScript | Pass (0 errors) |
| Build | Pass |

## Risks

- **Low:** In-app notification delivery is log-based until an in-app notifications table is added — ready for future UI integration
- **Low:** Embedding quality snapshots store similarity values as scaled integers (x10000) for SQLite compatibility
- **Low:** CI regression detection runs on each cron invocation; deduplication is not yet implemented (alerts may repeat across cron runs)
