# Known Issues

Track bugs, limitations, and technical debt here.

## Open

1. **In-memory rate limiter** — Rate limiter resets on restart and is per-process only. Ineffective for multi-instance deployments. Needs Redis-backed store if scaling horizontally.
2. **No JWT revocation store** — Compromised JWTs remain valid for up to 7 days until natural expiry. Acceptable risk at current user count but needs a revocation list for enterprise use.
3. **Single-instance SQLite** — SQLite single-writer lock limits concurrency. Fine for current deployment but blocks horizontal scaling. PostgreSQL migration plan exists (`docs/postgres-migration-plan.md`) but is deferred.
4. **No account lockout** — Rate limits reset per window; no permanent lockout after repeated auth failures.
5. **Cloudflare deployment blocked** — Issue #13 remains open. D1 compatibility with Drizzle ORM and FTS5 support are unknown blockers.

## Resolved

1. **CSRF protection** — Was dead code through Sprint 14. Fully wired in Sprint 15: double-submit cookie pattern with `timingSafeEqual`, all 10 mutation server actions protected, 10 dedicated tests. *(Sprint 15)*
2. **Structured logging** — Replaced bare `console.error` with pino structured logging across all server modules. *(Sprint 15)*
3. **SQLite concurrent writes (WAL)** — WAL mode enabled in `db/index.ts` with `busy_timeout=15000ms` and foreign keys on. Single-writer lock remains but WAL allows concurrent reads. *(Sprint 13)*
4. **AI rate limiting** — Per-provider 15-min throttle on 429, sliding hourly window with configurable `AI_MAX_REQUESTS_PER_HOUR` / `AI_MAX_TOKENS_PER_HOUR`. *(Sprint 19)*
5. **Session security** — JWT with proper expiry (7 days), middleware signature verification (Sprint 18), CSRF protection (Sprint 15), token hashing with SHA-256 (Sprint 22). *(Sprints 15-22)*
6. **Docker volume backup** — Automated SQLite backup script with WAL checkpointing and 7-day rotation. *(Sprint 16)*
7. **Email deliverability** — SPF/DKIM configured for surcod.ro. SMTP with templates and deliverability checks. *(Sprint 5)*
8. **Migration reliability** — Idempotent migrations with `IF NOT EXISTS`, retry logic, and fail-fast on errors. *(Sprint 21)*
9. **Proposal bar chart regression** — Bar width calculated as upvotes/total instead of upvotes/max, fixed in Sprint 15. Component tests added in Sprint 16 to prevent recurrence. *(Sprints 14-16)*
10. **Rate limiting on mutations** — Extended rate limiting from auth-only to proposals, votes, comments, and search endpoints. *(Sprint 18)*
