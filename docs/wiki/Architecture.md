# Architecture

## Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 (App Router) | Server Components, streaming, mature ecosystem |
| Language | TypeScript (strict mode) | Type safety, self-documenting code |
| Database | SQLite + Drizzle ORM | Portable, zero-config, D1-compatible for future Cloudflare deploy |
| Auth | Email magic link (JWT + nodemailer) | Zero external dependency, simple, reliable |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, accessible components |
| Testing | Playwright (E2E) + Vitest (unit) | Full coverage, adversarial model |
| Container | Docker multi-stage | Reproducible builds, staging/dev split |
| AI | Pluggable LLM (Gemini/OpenAI) | Summarization, similarity detection |

## Architecture Principles
1. **Server Components by default** — Client Components only for interactivity
2. **Server Actions for mutations** — No API routes unless needed for external integrations
3. **Max 300 lines per file** — Split if larger, keeps context windows manageable
4. **Error boundaries on every page** — Graceful failure
5. **Loading skeletons for all async** — No blank screens
6. **Mobile-first responsive** — Works on phone, tablet, desktop
7. **Feature flags** — Gradual rollout, easy rollback

## Data Model
```
users ←──┐
          │
projects ─┤── proposals ── votes
          │       │
          │       └── comments (threaded, self-referencing)
          │
          └── (audit_logs - future)
```

### Entity Details
- **users**: id, email, firstName, lastName, avatarUrl, role, createdAt
- **projects**: id, title, description (markdown), summary (AI), deadline, authorId, createdAt
- **proposals**: id, projectId, authorId, title, description (markdown), summary (AI), isNegativeInitiative, createdAt
- **votes**: proposalId + userId (composite PK), value (+1 or -1)
- **comments**: id, proposalId, parentId (threading), authorId, content (markdown), createdAt

## Auth Flow
1. User enters email on login page
2. Server generates JWT token, sends magic link via SMTP (configured SMTP provider)
3. User clicks link → server validates token → creates session cookie
4. Session: HTTP-only secure cookie with JWT
5. From: idea@surcod.ro

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

## SMTP Config
- Host: See .env.local
- User: See .env.local
- From: idea@surcod.ro

## Directory Structure
```
ideate/
├── PROJECT.md           # Master plan
├── AGENTS.md            # AI agent instructions
├── CHANGELOG.md         # Keep a Changelog format
├── docker-compose.yml   # Staging + Dev containers
├── Dockerfile           # Multi-stage production build
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── api/         # API routes (health, webhooks)
│   │   ├── (app)/       # Authenticated app routes
│   │   └── (auth)/      # Login/register/verify
│   ├── components/      # React components (<300 lines each)
│   │   └── ui/          # shadcn/ui primitives
│   ├── lib/             # Shared utilities
│   │   ├── auth.ts      # JWT + magic link
│   │   ├── mail.ts      # Nodemailer SMTP
│   │   ├── ai.ts        # LLM abstraction
│   │   └── utils.ts     # General helpers
│   ├── db/              # Database
│   │   ├── schema.ts    # Drizzle schema (single source of truth)
│   │   └── index.ts     # DB connection
│   └── types/           # Shared TypeScript types
├── tests/
│   ├── e2e/             # Playwright E2E tests
│   └── unit/            # Vitest unit tests
└── docs/
    └── sprints/         # Sprint documentation
```

## Key Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-15 | No WorkOS, email auth only | Simpler, zero external dependency |
| 2026-02-15 | SQLite over Postgres | Portable, dockerizable, future D1 compat |
| 2026-02-15 | Adversarial testing (Codex tests, Claude code) | Catches blind spots, higher quality |
| 2026-02-15 | 300-line file limit | Context window sustainability |
| 2026-02-15 | idea.surmont.co domain | Existing infra, nginx already configured |
