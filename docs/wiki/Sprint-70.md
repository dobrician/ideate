# Sprint 70 — Export Filters, Quality Trends, Regression Alerts, E2E Coverage & Notification Delivery

**Date:** 2026-03-05
**Status:** IN PROGRESS
**Focus:** Interactive export filters, embedding quality trend tracking, CI regression alerts engine, E2E for new admin pages, notification delivery wiring

## Goals

- [x] **Goal 1: Interactive Analytics Export Filters** — Date-range (startDate/endDate) and model/branch filters for CSV export endpoints and admin pages
- [x] **Goal 2: Embedding Quality Trend Tracking** — Periodic quality snapshots, trend API, admin UI chart/cards showing quality over time
- [x] **Goal 3: CI Regression Alerts Engine** — Detect regressions (duration, size, failure rate) between branches/runs, threshold config, persisted alerts
- [x] **Goal 4: E2E Coverage for New Admin Pages** — Stable selectors and robust assertions for export, embedding quality, CI comparison, notification prefs pages
- [ ] **Goal 5: Notification Delivery Wiring** — Connect notification preferences to real in-app and email delivery paths, honoring per-user category/channel toggles

## Commits

| Hash | Description |
|------|-------------|
| `a57239a` | Goal 1 — Interactive analytics export filters (date-range, mode, branch) |
| `fc09180` | Goal 2 — Embedding quality trend tracking (snapshots, trend API, cron) |
| `0ac20db` | Goal 3 — CI regression alerts engine (detection, persistence, API) |
| `TBD` | Goal 4 — E2E coverage for new admin pages (18 tests) |

## New Files

| File | Purpose |
|------|---------|

## Stats

| Metric | Value |
|--------|-------|
| Goals completed | 3/5 |
| Unit tests | 2817 (+28) |
| E2E tests | 201 (+18) |
| Lint | TBD |
| TypeScript | TBD |
| Build | TBD |

## Risks

- TBD
