# Cloudflare Deployment Spike (Issue #13)

**Date:** 2026-02-17
**Sprint:** 30
**Status:** Assessment complete — migration feasible with effort

## Stack Compatibility

| Component | Cloudflare Compatible? | Notes |
|---|---|---|
| Next.js 16 | Yes | Via `@opennextjs/cloudflare` with `nodejs_compat` flag |
| Drizzle ORM | Yes | First-class D1 support (`drizzle-orm/d1` adapter) |
| SQLite FTS5 | Yes | D1 supports FTS5 natively (use lowercase `fts5` in DDL) |
| better-sqlite3 | **No** | Native C++ addon, cannot run in V8 isolates |
| nodemailer | **No** | SMTP transport needs `net`/`tls` modules unavailable in Workers |
| pino | **No** | Depends on `fs`, `process`, `stream` — fails in Workers |
| bcryptjs | Partial | Can fail with crypto resolution errors |
| jsonwebtoken | Yes | Works with `nodejs_compat` (compatibility date >= 2024-09-23) |
| jsPDF | Yes | Pure JS, browser-compatible |
| Server Actions | Yes | Supported by `@opennextjs/cloudflare` |

## Blockers

### 1. `better-sqlite3` -> Cloudflare D1 (Blocker)
better-sqlite3 is a native Node.js addon. Workers run in V8 isolates with no native binary support.

**Fix:** Replace with D1 binding + `drizzle-orm/d1` adapter. Schema stays identical (same SQLite dialect). Drizzle Kit supports D1 migrations via `d1-http` driver. Estimated 2-3h: swap driver in `src/db/index.ts`, update migration runner, test all queries.

### 2. `nodemailer` SMTP (Blocker)
Nodemailer's SMTP transport requires `net` and `tls` modules unavailable in Workers.

**Fix options:**
- Replace with HTTP-based email API (Resend, SendGrid, Postmark) — simplest
- Use `worker-mailer` (SMTP client built for Workers using Cloudflare TCP Sockets)

Estimated 2-3h: swap `src/lib/mail.ts` to use HTTP API, update env vars.

### 3. `pino` logging (High)
Pino depends on Node.js `fs`, `process`, `stream` — all fail in Workers.

**Fix:** Replace with `console`-based structured logging or a lightweight edge logger. Estimated 1-2h: update `src/lib/logger.ts` and all imports.

### 4. `bcryptjs` (Medium)
Can fail with crypto resolution errors in Workers.

**Fix:** Replace with `bcrypt-edge` or use Web Crypto API (`SubtleCrypto`) directly. Estimated 1h: update `src/lib/password.ts`.

### 5. 25 MB bundle size limit (Medium)
Workers have a 25 MB compressed bundle limit. This stack is heavy (Next.js + jsPDF + Drizzle + react-markdown + remark-gfm).

**Mitigation:** Run `ANALYZE=true next build` to audit. May need to lazy-load jsPDF and react-markdown.

## What Works Without Changes

- Drizzle ORM schema definitions (identical SQLite dialect)
- FTS5 search queries (D1 supports FTS5)
- jsonwebtoken (with `nodejs_compat`)
- jsPDF PDF generation
- Next.js Server Actions
- All React components and UI code
- Tailwind CSS, shadcn/ui, lucide-react

## Migration Estimate

| Task | Effort |
|---|---|
| Replace better-sqlite3 with D1 adapter | 2-3h |
| Replace nodemailer with HTTP email API | 2-3h |
| Replace pino with edge-compatible logger | 1-2h |
| Replace bcryptjs with bcrypt-edge | 1h |
| Bundle size optimization | 1-2h |
| D1 database migration (data) | 1h |
| Testing and debugging | 3-4h |
| **Total** | **11-16h** |

## Recommendation

**Defer implementation.** The current Docker + Nginx Proxy Manager deployment works well for a single-instance app. Migration to Cloudflare requires replacing 3-4 core dependencies, which introduces regression risk. Pursue only if:
- Free hosting is a priority (Cloudflare free tier)
- Global edge performance is needed
- Multi-region deployment is required

The assessment confirms it is technically feasible with the effort above.

## References

- `@opennextjs/cloudflare`: https://opennext.js.org/cloudflare
- Drizzle ORM D1: https://orm.drizzle.team/docs/connect-cloudflare-d1
- D1 FTS5: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- worker-mailer: https://github.com/zou-yu/worker-mailer
