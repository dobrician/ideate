# Sprint 52 — Advanced Search & Discovery: Semantic Search with Embeddings

**Date:** 2026-02-22
**Status:** COMPLETE
**Focus:** Add semantic search with vector embeddings, content recommendations, trend detection

## Goals

- [x] **Goal 1: Vector Embeddings Infrastructure** — `embeddings` table with JSON-serialized vector storage. `src/lib/embeddings/` module supporting OpenAI (`text-embedding-3-small`) and local TF-IDF fallback (256-dim via FNV-1a hashing). Embedding generation job integrated with queue system.
- [x] **Goal 2: Semantic Search Engine** — `src/lib/semantic-search.ts` with three modes: FTS5 keyword, embedding-based semantic, and hybrid (Reciprocal Rank Fusion). Search API extended with `mode` parameter. Graceful fallback to FTS5 when embeddings unavailable.
- [x] **Goal 3: Content Recommendations** — `src/lib/recommendations/` with three strategies: content similarity (averaged embedding vectors), collaborative filtering (overlapping voter patterns), and popularity-based fallback. API at `/api/proposals/recommendations`.
- [x] **Goal 4: Trend Detection System** — `src/lib/analytics/trends.ts` with keyword frequency tracking, vote momentum scoring (weighted votes + comments), growth percentage calculation. API at `/api/analytics/trends`.
- [x] **Goal 5: Search & Discovery UI** — Search bar with FTS/Semantic/Smart mode toggle. Trending widget (topics + proposals) and recommendations widget on dashboard. Similar proposals component. GET endpoint for embedding-based similarity. Full i18n support (en + ro).

## Outcomes

- 5 commits (one per goal)
- 1763 tests passing, 128 test files
- Lint and typecheck clean
- New files: 14 source, 7 test
- Modified: search API, dashboard, PG schema, similarity route, i18n

## Notes
- OpenAI embeddings require OPENAI_API_KEY; local TF-IDF works without external dependencies
- Embedding generation is async via job queue to avoid blocking UI
- Hybrid search uses Reciprocal Rank Fusion (k=60) to merge FTS and semantic results
- Build has pre-existing middleware/proxy conflict in Next.js 16.1.6 (not introduced by this sprint)
