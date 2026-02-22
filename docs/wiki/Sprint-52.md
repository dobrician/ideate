# Sprint 52 — Advanced Search & Discovery: Semantic Search with Embeddings

**Date:** 2026-02-22
**Focus:** Add semantic search with vector embeddings, content recommendations, trend detection

## Goals

- [ ] **Goal 1: Vector Embeddings Infrastructure** — Add `embeddings` table to schema with vector blob storage. Create `src/lib/embeddings/` module with OpenAI/local embedding generation. Add embedding generation job to queue system.
- [ ] **Goal 2: Semantic Search Engine** — Extend existing FTS5 search in `src/lib/search.ts` with semantic search option. Implement cosine similarity search. Graceful fallback to FTS5 when embeddings unavailable.
- [ ] **Goal 3: Content Recommendations** — Create `src/lib/recommendations/` module. Generate proposal recommendations based on user voting history and content similarity. Add recommendation API at `/api/proposals/recommendations/route.ts`.
- [ ] **Goal 4: Trend Detection System** — Implement trending topics detection in `src/lib/analytics/trends.ts`. Track keyword frequency over time, vote momentum, discussion activity. Add trends API endpoint.
- [ ] **Goal 5: Search & Discovery UI** — Update search with semantic search toggle. Add recommendation components. Add trending topics widget. Include "similar proposals" section on proposal pages.

## Notes
- Support both OpenAI embeddings (when API key available) and local TF-IDF fallback
- Embedding generation is async via job queue to avoid blocking UI
- Search gracefully falls back to FTS5 when embeddings unavailable
