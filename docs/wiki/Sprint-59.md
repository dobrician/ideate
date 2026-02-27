# Sprint 59 — Search & Discovery: Advanced Features & Integration

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Advanced search filters, federated search, analytics tracking, smart suggestions, search API enhancement

## Goals

- [x] **Goal 1: Advanced Search Filters** — New `src/lib/search/filters.ts` module with comprehensive filtered FTS5 search. Supports 8 filter types: date range (`dateFrom`/`dateTo`), author (`authorId`), tags (tag name matching via `project_tags`/`proposal_tags` joins), minimum vote count (`minVotes` with subquery count), project scope (`projectId`), entity type filtering (`entityTypes`), and project status (`projectStatus`). Each entity search (projects, proposals, comments) builds dynamic WHERE clauses with parameterized queries. Saved searches CRUD at `src/lib/search/saved.ts` with user-scoped storage.

- [x] **Goal 2: Federated Cross-Entity Search** — Enhanced search API at `/api/search` accepts all filter parameters as query params. Unified ranking with score-based sorting across all entity types. Comments weighted at 0.8x for balanced ranking. Entity type filter allows within-project or cross-project scoping. Results include `authorName`, `voteCount`, and `createdAt` metadata for richer display.

- [x] **Goal 3: Search Analytics & Optimization** — `search_analytics` table tracking every query with user, mode, filters (JSON), result count, response time (ms), and click-through data. `search_suggestions` table caching popular queries with frequency and average results. Analytics module at `src/lib/search/analytics.ts` with: `trackSearch()` (async, non-blocking), `trackSearchClick()`, `getPopularSearches()`, `getZeroResultSearches()`, `getSearchStats()` (aggregate dashboard stats). Admin dashboard at `/admin/search-analytics` with 4 stat cards, mode breakdown, popular searches list, and zero-result queries list.

- [x] **Goal 4: Smart Search Suggestions** — `src/lib/search/suggestions.ts` with multi-source autocomplete: popular search queries (frequency-ranked), project titles, proposal titles, tag names. Typo correction via Levenshtein distance algorithm (max edit distance: `floor(length/3)`, minimum 2). New `/api/search/suggestions` endpoint with 150ms debounce on client. Enhanced search bar shows suggestions dropdown before search triggers, "did you mean" correction for zero-result queries.

- [x] **Goal 5: Search API Enhancement** — 4 new API routes: `/api/search/suggestions` (autocomplete, 120/15min rate limit), `/api/search/click` (click tracking with validation), `/api/search/saved` (GET/POST/DELETE for bookmarked searches), `/api/search/export` (CSV/JSON export with 100-result limit, 10/15min rate limit). Enhanced main search route returns `analyticsId` for click attribution. CSV export strips HTML from snippets and properly escapes quotes.

## Outcomes

- 1 commit, 4284 lines added
- 2116 tests passing, 152 test files
- 153 new tests across 5 test files
- Lint and typecheck clean, build successful
- Migration 0030 with 3 new tables (search_analytics, saved_searches, search_suggestions) and 7 indexes
- Refactored: `search.ts` moved to `search/fts.ts` with barrel re-export preserving all existing imports

## New Files

| File | Purpose |
|------|---------|
| `drizzle/0030_sprint59_search_discovery.sql` | Migration: 3 tables, 7 indexes |
| `src/lib/search/filters.ts` | Filtered FTS5 search engine |
| `src/lib/search/analytics.ts` | Search analytics tracking & stats |
| `src/lib/search/suggestions.ts` | Autocomplete & typo correction |
| `src/lib/search/saved.ts` | Saved searches CRUD |
| `src/lib/search/index.ts` | Barrel export + re-export of FTS |
| `src/lib/search/fts.ts` | Original FTS search (moved from search.ts) |
| `src/app/api/search/suggestions/route.ts` | Autocomplete API |
| `src/app/api/search/click/route.ts` | Click tracking API |
| `src/app/api/search/saved/route.ts` | Saved searches API |
| `src/app/api/search/export/route.ts` | Search export API |
| `src/app/admin/search-analytics/page.tsx` | Admin search analytics dashboard |

## Modified Files

| File | Changes |
|------|---------|
| `src/app/api/search/route.ts` | Added filter parsing, analytics tracking, analyticsId response |
| `src/components/search-bar.tsx` | Suggestions, entity filter toggles, click tracking, "did you mean" |
| `src/db/schema.ts` | +3 table definitions (searchAnalytics, savedSearches, searchSuggestions) |
| `src/db/schema-pg.ts` | +3 matching PostgreSQL table definitions |
| `src/app/admin/page.tsx` | +Search Analytics nav link |
| `src/lib/translations/en.ts` | +28 translation keys |
| `src/lib/translations/ro.ts` | +28 Romanian translation keys |

## Audit Results

### Architecture / Code Quality
- Search module properly decomposed into sub-modules: fts, filters, analytics, suggestions, saved
- Barrel export at `search/index.ts` preserves backward compatibility for all existing imports
- Filtered search uses parameterized SQL queries throughout (no SQL injection risk)
- Analytics tracking is async (non-blocking) to avoid impacting search response times
- Suggestion engine combines multiple data sources with deduplication
- Levenshtein distance implementation is pure computation with no external dependencies
- Admin dashboard follows existing patterns (RBAC check, translations, back navigation)

### Security
- All new API routes require authentication via `getCurrentUser()`
- Rate limiting on all endpoints: search (60/15min), suggestions (120/15min), export (10/15min)
- Click tracking validates `resultType` against whitelist before accepting
- Saved searches enforced per-user ownership on delete operations
- Search query truncated to 500 chars, saved search name to 200 chars
- Filter parameters validated (enum checks for mode, status, entityTypes)
- CSV export strips HTML tags from snippets to prevent XSS in downstream tools
- No raw SQL interpolation — all filters use parameterized `?` placeholders

### Performance
- 7 database indexes covering: search_analytics (query, user_id, created_at), saved_searches (user_id), search_suggestions (frequency DESC, query)
- Analytics insertion is fire-and-forget (`.catch(() => {})`)
- Suggestions use LIKE with prefix matching (`prefix%`) which leverages B-tree indexes
- Filtered search opens read-only database connection with 3s busy timeout
- Comment scores weighted at 0.8x to avoid comment-heavy results dominating
- Typo correction limited to top 100 popular queries by frequency

### Tests
- 153 new tests: filters (42), analytics (25), suggestions (19), saved (19), API routes (48)
- 2116 total tests, 152 files, all passing
- Tests cover: happy paths, error handling, edge cases (empty queries, DB errors, rate limits)
- Existing search tests updated for new barrel export structure

### UX / Accessibility
- Filter toggle button with `aria-pressed` state and icon color feedback
- Entity type filter pills with clear button
- Suggestions shown with type icons (TrendingUp, FileText, Tag, Sparkles)
- "Did you mean" link for typo correction on zero-result searches
- Keyboard navigation works across both suggestions and search results
- Author names and vote counts shown on search results for richer context
- All new UI elements have proper ARIA labels and roles
