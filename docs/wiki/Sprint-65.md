# Sprint 65 — Observability & Search: CI Metrics, Query Profiling, WCAG AAA, Embeddings & E2E Expansion

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** CI build metrics & artifact fixes, database query profiling expansion, WCAG AAA high contrast & aria-keyshortcuts, semantic search embedding wiring, E2E test expansion for admin & search pages

## CI Incident (pre-sprint)

Sprint 64's artifact sharing introduced two issues:
1. `upload-artifact@v4` excludes hidden directories by default (`.next/` starts with a dot)
2. `upload-artifact@v4` rejects filenames containing colons (Next.js generates `node:inspector` chunks)

**Fix:** Tar `.next/` and `data/` before upload, extract after download. Commits: `f37341b`, `cefbad4`.

## Goals

- [x] **Goal 1: CI Build Metrics** — Added build timing with `$SECONDS` and `::notice` annotations. Added build size reporting (`du -sh .next/`). 4 new CI config tests.

- [x] **Goal 2: Database Query Profiling Expansion** — Expanded COMMON_QUERIES from 6 to 16 (added 10 FK join queries covering Sprint 64 indexes). Added `getQueryExplainSummary()` function. Added summary stat cards to QueryExplainPanel (total queries, indexed count, coverage %). i18n keys for en/ro. 9 new query explain tests + 2 panel DOM tests.

- [x] **Goal 3: WCAG AAA Completion** — Created `useHighContrast()` reactive hook for `forced-colors` and `prefers-contrast: more` media queries. Added `aria-keyshortcuts="Control+K Meta+K"` to search bar. Added `@media (forced-colors: active)` CSS rules for cards, badges, buttons, skeletons. 12 new tests (5 hook, 6 a11y, 1 search-bar).

- [x] **Goal 4: Semantic Search Wiring** — Added `enqueueEmbedding("project", projectId)` to `createProject()` action. Added `enqueueEmbedding("proposal", proposalId)` to `createProposal()` action. Registered embedding handlers in cron/jobs route at module level. 5 new tests.

- [x] **Goal 5: E2E Test Expansion** — Created `tests/e2e/admin.test.ts` (10 tests: admin page load, sub-pages, non-admin denied, unauthenticated redirect). Created `tests/e2e/search.test.ts` (6 tests: search bar visible, aria-keyshortcuts, Ctrl+K focus, results area, ARIA combobox, mode toggle). Extended seed API with role parameter.

## Results

- **Tests:** 2639 unit tests (181 files, 0 failures) + 16 new E2E tests — up from 2609 (+30 unit, +16 E2E)
- **Lint:** Clean (0 warnings, 0 errors)
- **TypeScript:** Clean (strict mode, 0 errors)
- **E2E files:** 17 (up from 15)

## Commits

| Hash | Description |
|------|-------------|
| `f37341b` | fix(ci): include hidden .next/ dir in upload-artifact |
| `cefbad4` | fix(ci): tar .next/ before artifact upload (colon fix) |
| `fc6dc4c` | feat(perf): Goals 1-2 — CI build metrics + query profiling |
| `5a14392` | feat(a11y): Goal 3 — WCAG AAA high contrast + aria-keyshortcuts |
| `fe7e2d1` | feat(search): Goal 4 — wire embedding auto-generation |
| `3364e78` | test(e2e): Goal 5 — admin and search E2E tests |

## Final Audit

### Architecture (STRONG)
- Server Components by default, Client Components only for interactivity
- 300-line file limit enforced
- Clean module separation: 16+ lib modules, each with dedicated tests
- Dual database support (SQLite + PostgreSQL) via adapter pattern
- 3-layer cache (Memory L1 -> Redis L2 -> SQLite L3) with tag-based invalidation
- All 50 FK columns indexed
- Embedding auto-generation wired into server actions (fire-and-forget pattern with error logging)
- Cron route registers embedding handlers at module load time

### Security (LOW RISK)
- 4 moderate esbuild CVEs remain in drizzle-kit (dev dependency, not exploitable in production)
- Timing-safe comparison on all secret comparisons
- SSRF prevention in offline sync replay
- Per-user rate limiting on all authenticated endpoints
- JWT with JTI blocklist, auto-rotation, HTTP-only cookies
- CSP, HSTS, X-Frame-Options, Permissions-Policy headers active
- E2E seed endpoint gated by `E2E_TEST_SECRET` env var (returns 404 if unset)
- Role-based access control verified in E2E (admin, member, unauthenticated)

### Performance (PRODUCTION READY)
- CI build timing and size now reported via `::notice` annotations
- 16 query explain plans validated (all using indexes, 100% coverage)
- `optimizePackageImports` covers 5 heavy packages
- CI pipeline: tar-based artifact sharing (fixes hidden dir + colon issues)
- Playwright browser caching active

### Tests (EXCELLENT)
- 2639 unit tests across 181 files
- 17 E2E test files (31+ E2E tests total)
- +30 new unit tests, +16 new E2E tests this sprint
- TypeScript strict mode clean, ESLint clean
- Admin page E2E: role-based access (admin loads, member denied, anon redirected)
- Search E2E: ARIA attributes, keyboard shortcuts, search results

### UX/Accessibility (90% WCAG AAA)
- `useHighContrast()` hook: detects `forced-colors: active` and `prefers-contrast: more`
- `@media (forced-colors: active)` CSS: cards, badges, buttons, skeletons get visible borders
- `aria-keyshortcuts="Control+K Meta+K"` on search input
- All 9 loading pages: `aria-busy="true"`, `role="status"`, sr-only text
- Skeleton component: `aria-hidden`, `motion-reduce:animate-none`
- Dialog close buttons: 44x44px verified
- Touch targets: 44x44px throughout
- Dark mode with high contrast (OKLch)
- **Improvement from 85% to 90% WCAG AAA** (high contrast + aria-keyshortcuts)

### CI Status (HEALTHY)
- All 7 jobs: lint, typecheck, test, build, smoke-tests, e2e-tests, docker-push
- Build artifact sharing via tar (fixes hidden dir + colon issues from Sprint 64)
- Build timing and size reported via `::notice` annotations
- Playwright browser caching active
- docker-push gated on both smoke AND e2e tests
- No `continue-on-error` anywhere

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| 4 esbuild CVEs in drizzle-kit (dev only) | LOW | Dev dependency, not in production bundle; monitor for drizzle-kit update |
| Embedding auto-generation fire-and-forget | LOW | Errors logged via pino, job queue retries failed embeddings; monitor queue depth |
| In-memory rate limiting (single-instance) | LOW | Acceptable for current scale; Redis rate limits for multi-instance |
| Health endpoint exposes version info | LOW | Gate behind admin auth or redact in future sprint |
| E2E tests depend on seed API availability | LOW | Gated by E2E_TEST_SECRET, returns 404 in production |

## Next Sprint Priorities

1. **Semantic search UI** — Search mode toggle between FTS and semantic, display similarity scores
2. **Embedding model configuration** — Admin UI for configuring embedding provider (OpenAI, local)
3. **CI timing trends** — Track build duration over time, alert on regressions
4. **E2E coverage expansion** — Cover remaining pages (projects, proposals, comments, voting)
5. **WCAG AAA final push** — Reach 95%+ (focus indicators, color contrast in all states)
