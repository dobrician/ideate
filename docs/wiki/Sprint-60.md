# Sprint 60 — Performance & Scale: Advanced Caching & Optimization

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Multi-layer caching, CDN integration, DB query optimization, frontend performance, monitoring suite

## Goals

- [x] **Goal 1: Advanced Caching Strategy** — New `src/lib/cache/ttl.ts` with 5 TTL tiers (static/slow/moderate/fast/realtime) and entity-type mapping for 14+ data types. New `src/lib/cache/tags.ts` with tag-based cache invalidation supporting associate/invalidate/bulk operations with 5000-entry limit. New `src/lib/cache/warming.ts` with registered warmer functions, batch warming, and single-key re-warming. Updated `src/lib/cache/invalidate.ts` with working prefix-based bulk invalidation scanning memory keys and tag-based invalidation on project/proposal mutations. Added `getMemoryKeys()` export to cache index.

- [x] **Goal 2: CDN & HTTP Cache Headers** — New `src/lib/cache/headers.ts` with 5 pre-defined cache policies (static/apiPublic/apiPrivate/page/none), Cache-Control header builder supporting max-age, stale-while-revalidate, must-revalidate, no-store directives. ETag generation via MD5 hash with conditional request support (If-None-Match/304). Updated `next.config.ts` with immutable headers for `/_next/static/` (1 year), icons (1 day + SWR), and manifest (1 hour + SWR).

- [x] **Goal 3: Database Query Optimization** — New `src/lib/cache/query.ts` with `cachedQuery` and `cachedQueryAsync` decorators wrapping any query function with automatic caching, entity-aware TTL, optional tag association, and corrupted-cache recovery. New `src/lib/db/statement-cache.ts` with prepared statement metadata tracking (200 capacity, LRU eviction), usage counting, and top-10 most-used statement reporting. Enhanced `src/db/index.ts` pool with `totalAcquired`, `totalReleased`, and `peakActive` counters.

- [x] **Goal 4: Frontend Performance** — New `src/lib/perf-budget.ts` with performance budget definitions covering JS/CSS bundle sizes, API P95, page load, and all 5 Core Web Vitals (LCP/FID/CLS/INP/TTFB). Budget checker with warning (1x) and critical (1.5-2.5x) severity levels. New `src/lib/web-vitals.ts` with client-side metric collection, rating against web.dev thresholds, buffered send via `navigator.sendBeacon`, and debounced 5-second flush.

- [x] **Goal 5: Performance Monitoring Dashboard** — New unified admin dashboard at `/admin/perf-dashboard/` combining: response time stats (avg/P95/P99), cache hit rates, memory usage, database pool stats (connections, peak, acquired/released), statement cache stats, tag-based cache metrics, slowest paths, and recent performance alerts. New `/api/perf/vitals` endpoint (POST to collect, GET for summary with P75/avg/good/poor counts, 1-hour window). New `src/lib/perf-alerts.ts` with threshold-based alerting for API latency, cache hit rate, memory usage, and error rate with warning/critical severity levels. Admin nav link added. +22 EN/RO translation keys.

## New Files

| File | Purpose |
|------|---------|
| `src/lib/cache/ttl.ts` | Configurable TTL tiers by data type |
| `src/lib/cache/tags.ts` | Tag-based cache invalidation |
| `src/lib/cache/warming.ts` | Cache warming for critical paths |
| `src/lib/cache/headers.ts` | HTTP cache header utilities + CDN policies |
| `src/lib/cache/query.ts` | Query result caching decorator |
| `src/lib/db/statement-cache.ts` | Prepared statement metadata tracking |
| `src/lib/perf-budget.ts` | Performance budgets and threshold checking |
| `src/lib/web-vitals.ts` | Core Web Vitals collection and reporting |
| `src/lib/perf-alerts.ts` | Performance alerting with thresholds |
| `src/app/api/perf/vitals/route.ts` | Web Vitals collection API (POST + GET) |
| `src/app/admin/perf-dashboard/page.tsx` | Unified performance dashboard |
| `src/app/admin/perf-dashboard/perf-dashboard-panel.tsx` | Dashboard client component |
| `tests/unit/cache-ttl.test.ts` | TTL tier tests (5 tests) |
| `tests/unit/cache-tags.test.ts` | Tag invalidation tests (15 tests) |
| `tests/unit/cache-warming.test.ts` | Cache warming tests (13 tests) |
| `tests/unit/cache-headers.test.ts` | HTTP cache header tests (20 tests) |
| `tests/unit/cache-query.test.ts` | Query caching tests (12 tests) |
| `tests/unit/statement-cache.test.ts` | Statement cache tests (8 tests) |
| `tests/unit/perf-budget.test.ts` | Performance budget tests (14 tests) |
| `tests/unit/web-vitals.test.ts` | Web Vitals tests (18 tests) |
| `tests/unit/perf-alerts.test.ts` | Alerting tests (18 tests) |
| `tests/unit/perf-vitals-api.test.ts` | Vitals API route tests (11 tests) |

## Modified Files

| File | Changes |
|------|---------|
| `src/lib/cache/index.ts` | +`getMemoryKeys()` export for prefix invalidation |
| `src/lib/cache/invalidate.ts` | Implemented prefix invalidation, added tag-based invalidation on mutations |
| `src/db/index.ts` | Enhanced pool stats with totalAcquired, totalReleased, peakActive |
| `next.config.ts` | Added immutable cache headers for static assets, icons, manifest |
| `src/app/admin/page.tsx` | Added Performance Dashboard nav link |
| `src/lib/translations/en.ts` | +22 perfDashboard translation keys |
| `src/lib/translations/ro.ts` | +22 perfDashboard Romanian translation keys |
| `tests/unit/cache-invalidate.test.ts` | Updated for prefix invalidation + tag integration |

## Outcomes

- 1 commit, 12 new source files, 11 new test files
- 2254 tests passing, 157 test files
- 138 new tests across 11 test files
- Lint, typecheck, and build all clean
- No new migration needed (no schema changes)

## Audit Results

### Architecture / Code Quality
- Cache modules properly decomposed: ttl, tags, warming, headers, query (each single-responsibility)
- Tag-based invalidation uses efficient bidirectional index (tag->keys + key->tags)
- Cache warming is registration-based, allowing modules to self-register
- Query caching decorator pattern avoids changing existing query callsites
- Performance budgets define clear thresholds with warning/critical severity
- Web Vitals collection uses sendBeacon for reliable delivery
- All new modules under 120 lines (well within 300-line limit)
- Dashboard follows existing admin page patterns (RBAC check, translations, back nav)

### Security
- Web Vitals API validates metric names against whitelist (LCP/FID/CLS/INP/TTFB)
- URL truncation to 200 chars prevents oversized storage
- Metrics count limited to 20 per request to prevent abuse
- Non-finite values (NaN, Infinity) rejected
- Rating validated against known values
- No authentication required for vitals collection (standard web vitals pattern)
- Cache headers use appropriate public/private scopes
- ETag uses weak validation (W/) as recommended for dynamic content

### Performance
- L1 memory cache scan for prefix invalidation is O(n) but bounded by 500-entry limit
- Tag index bounded at 5000 entries with LRU eviction
- Statement cache bounded at 200 entries with LRU eviction
- Cache warming is async with per-warmer error isolation
- Web Vitals buffered and flushed in batch (5-second debounce)
- Vitals API uses circular buffer (1000 entries) for constant memory
- Static assets get immutable 1-year cache headers (eliminates revalidation)
- CDN headers enable stale-while-revalidate for non-blocking refresh

### Tests
- 138 new tests: ttl (5), tags (15), warming (13), headers (20), query (12), statements (8), budget (14), vitals (18), alerts (18), vitals-api (11), invalidate-update (4)
- 2254 total tests, 157 files, all passing
- Tests cover: happy paths, edge cases, error handling, boundary conditions
- Navigator/location properly stubbed for Node test environment

### UX / Accessibility
- Dashboard uses consistent StatCard pattern from existing admin pages
- Alert severity color-coded: destructive for critical, yellow for warning
- Slowest paths and alerts use monospace font for readability
- All sections have proper headings with lucide icons
- Mobile-responsive grid layout (1-col mobile, 2-col tablet, 4-col desktop)
- All text uses translation keys for i18n support (EN + RO)
