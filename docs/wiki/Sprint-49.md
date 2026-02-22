# Sprint 49 — Performance & Scale Hardening: Background Jobs & Query Optimization

**Date:** 2026-02-19
**Focus:** Add background job infrastructure, query optimization, and performance monitoring foundation

## Goals

- [x] **Goal 1: Background Job Queue System** — Create `src/lib/queue/` module with SQLite-backed job queue. Add `job_queue` table to schema. Implement `JobQueue` class with `enqueue()`, `process()`, `retry()` methods. Add cron worker at `/api/cron/jobs/route.ts`.
- [x] **Goal 2: Query Optimization Audit** — Add database indexes for common queries: `projects.deadline`, `proposals.createdAt`, `votes.createdAt`, `comments.proposalId+createdAt`. Add query explain plans to admin dashboard at `/src/app/admin/performance/page.tsx`.
- [x] **Goal 3: Caching Infrastructure** — Create `src/lib/cache/` module with multi-layer cache (memory + SQLite). Add `cache_entries` table to schema. Implement cache middleware for API routes and server actions.
- [x] **Goal 4: Performance Monitoring** — Add request timing middleware to `/src/middleware.ts`. Create performance dashboard at `/src/app/admin/monitoring/page.tsx` with response times, cache hit rates, job queue stats.
- [x] **Goal 5: Memory & Resource Limits** — Add memory usage tracking to admin dashboard. Implement connection pooling for database. Add request timeout middleware (30s) to prevent hanging requests.

## Notes
- Run tests after each goal: `npm run lint && npx tsc --noEmit && npm test`
