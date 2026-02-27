# Architecture

## Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 (App Router) | Server Components, streaming, mature ecosystem |
| Language | TypeScript 5.9 (strict mode) | Type safety, self-documenting code |
| Database | SQLite + Drizzle ORM (+ PostgreSQL adapter) | Portable, dual-DB support |
| Auth | Email magic link + password (JWT) | Dual auth, zero external dependency |
| SSO | OIDC (OpenID Connect) | Enterprise single sign-on |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, accessible components |
| Testing | Playwright (E2E) + Vitest (unit) | 2520+ tests, full coverage |
| Container | Docker multi-stage (standalone) | Reproducible builds, CI/CD |
| AI | Pluggable LLM (Gemini/OpenAI) | Summarization, routing, insights |
| Cache | 3-layer (Memory + Redis + SQLite) | L1/L2/L3 with tag-based invalidation |
| Real-time | WebSocket + SSE | Live collaboration, presence |
| PWA | Service Worker + Web Push | Offline-first, push notifications |

## Architecture Principles
1. **Server Components by default** — Client Components only for interactivity
2. **Server Actions for mutations** — No API routes unless needed for external integrations
3. **Max 300 lines per file** — Split if larger, keeps context windows manageable
4. **Error boundaries on every page** — Graceful failure
5. **Loading skeletons for all async** — No blank screens
6. **Mobile-first responsive** — Works on phone, tablet, desktop (320px+)
7. **WCAG 2.1 AAA accessibility** — Skip nav, ARIA landmarks, focus management
8. **Offline-first PWA** — IndexedDB sync queue, SW cache strategies

## Data Model
```
users ←──┐
          │
projects ─┤── proposals ── votes
          │       │
          │       └── comments (threaded, self-referencing)
          │
          ├── audit_logs
          ├── api_keys
          ├── webhooks ── webhook_deliveries
          ├── integrations (Slack/Teams/Discord)
          ├── push_subscriptions
          ├── workflow_stages ── workflow_transitions
          ├── search_analytics
          └── cache_entries / jobs
```

## Module Organization
```
src/lib/
├── a11y/            # WCAG AAA utilities (announce, trapFocus, contrast)
├── ai/              # Smart routing, conflicts, deadlines, roadmap, insights
├── analytics/       # Velocity, social, momentum, predictions, trends
├── cache/           # 3-layer cache + TTL, tags, warming, headers, query
├── db/              # Statement cache, migration helpers
├── integrations/    # Slack, Teams, Discord adapters + dispatcher
├── offline/         # IndexedDB sync queue + cache strategies
├── ot/              # Operational Transform engine
├── push/            # Web Push VAPID + subscription management
├── queue/           # SQLite-backed job queue
├── rbac/            # RBAC permissions (client-safe + server-only)
├── search/          # FTS5, filters, analytics, suggestions, saved
├── embeddings/      # AI vector embeddings
├── presence/        # Real-time presence tracking
├── pubsub/          # Pub/Sub messaging
├── redis/           # Redis client utilities
└── websocket/       # WebSocket handlers
```

## Auth Flow
1. User enters email on login page
2. **Magic link path:** Server generates JWT token, sends magic link via SMTP
3. **Password path:** Server validates bcrypt hash, creates session
4. **OIDC path:** Redirect to IdP, callback validates token
5. Session: HTTP-only secure cookie with JWT (7-day expiry, auto-rotation)
6. CSRF: sameSite=lax + Origin header validation

## Security Layers
- JWT with JTI blocklist for token revocation
- CSRF dual defense (cookie + origin)
- Rate limiting on all endpoints (per-user keys)
- API keys: `idk_` prefix, SHA-256 hashing, timing-safe comparison, 3 tiers
- Webhook HMAC-SHA256 signatures with timing-safe verification
- CSP, HSTS, X-Frame-Options, Permissions-Policy headers
- Push notification URL validation (HTTPS only, same-origin clicks)
- Offline sync SSRF prevention (relative paths only)

## Docker Architecture
```
┌─────────────────────┐    ┌─────────────────────┐
│  Staging (:4100)    │    │  Dev (:4101)         │
│  Always running     │    │  Sprint work         │
│  Stable release     │    │  May be broken       │
└────────┬────────────┘    └──────────────────────┘
         │
    nginx proxy
         │
  idea.surmont.co (HTTPS)
```

## CI Pipeline (GitHub Actions)
```
push/PR to main
    ├── lint (ESLint)
    ├── typecheck (tsc --noEmit)
    ├── test (Vitest: 2520+ tests)
    └── build (Next.js standalone)
        ├── smoke-tests (Playwright)
        │   └── docker-push (ghcr.io)
        └── e2e-tests (Playwright: desktop + mobile)
```

## Key Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-15 | No WorkOS, email auth only | Simpler, zero external dependency |
| 2026-02-15 | SQLite over Postgres | Portable, dockerizable |
| 2026-02-15 | Adversarial testing model | Catches blind spots, higher quality |
| 2026-02-15 | 300-line file limit | Context window sustainability |
| 2026-02-19 | Added PostgreSQL adapter | Horizontal scaling option |
| 2026-02-19 | Added Redis L2 cache | Performance at scale |
| 2026-02-27 | Removed Cloudflare deploy | Node-only runtime (better-sqlite3) |
| 2026-02-27 | 3-layer cache system | Memory + Redis + SQLite for reliability |
| 2026-02-27 | IndexedDB connection pooling | 10x faster offline sync |
