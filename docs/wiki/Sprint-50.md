# Sprint 50 — Horizontal Scaling: Redis Infrastructure & Database Flexibility

**Date:** 2026-02-19
**Focus:** Add Redis support for pub/sub and caching, PostgreSQL adapter alongside SQLite

## Goals

- [x] **Goal 1: Redis Integration Setup** — Add Redis client in `src/lib/redis/index.ts`. Add Redis config to `next.config.ts` and `.env.example`. Update Docker Compose with Redis container. Add Redis health check to `/api/health/route.ts`.
- [x] **Goal 2: Redis-backed Pub/Sub** — Create `src/lib/pubsub/` module with `RedisPubSub` and `MemoryPubSub` implementations. Update vote stream `/api/votes/stream/route.ts` to use Redis pub/sub when available, fallback to memory.
- [x] **Goal 3: PostgreSQL Database Adapter** — Add PostgreSQL support to `src/db/pg.ts` with connection pooling. Update `drizzle.config.ts` to support both SQLite and PostgreSQL via env var `DATABASE_DRIVER`. Keep SQLite as default.
- [ ] **Goal 4: Database Migration Compatibility** — Ensure all migrations work on both SQLite and PostgreSQL. Add PostgreSQL-specific migration path in `/drizzle-pg/`. Update schema types to handle database-specific differences.
- [ ] **Goal 5: Redis Cache Integration** — Update cache layer from Sprint 49 to use Redis as L2 cache when available. Add Redis cache statistics to admin monitoring dashboard. Implement cache invalidation on data changes.

## Notes
- Database driver selection via `DATABASE_DRIVER=sqlite|postgresql` env var
- Redis is optional — system degrades gracefully to in-memory pub/sub
- After each goal: commit+push code, update this file's checkbox, commit+push, then wiki sync to /tmp/ideate.wiki
- Run tests after each goal: `npm run lint && npx tsc --noEmit && npm test`
