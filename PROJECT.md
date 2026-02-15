# Ideate — Project Plan

## Vision
Enterprise-grade democratic idea prioritization platform. Rebuilt from scratch based on the original "ideator" project, designed for perpetual autonomous development.

## Original Feature Set (from ideator)
- Projects with deadlines and descriptions
- Proposals with markdown, AI summaries, similarity detection
- Pro/Contra voting (+1/-1, toggle, visual bar chart)
- Threaded comments
- i18n (EN/RO)
- WorkOS authentication (SSO/Google/Magic Link)
- Gemini AI for summarization

## Architecture Decisions

### Stack
- **Framework:** Next.js 15+ (App Router) — proven, good DX, enterprise-ready
- **Database:** SQLite via Drizzle ORM (portable, simple, D1-compatible later)
- **Auth:** Email-based magic link (nodemailer + JWT, NO WorkOS)
- **AI:** Pluggable LLM layer (Gemini default, OpenAI fallback)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Testing:** Playwright E2E + Vitest unit tests
- **Runtime:** Docker (multi-stage build, production-ready)

### Enterprise Additions (vs original)
- Role-based access (admin, manager, member, viewer)
- Audit logging
- API rate limiting
- Health check endpoints
- Proper error boundaries
- Structured logging
- Database migrations versioning
- Multi-tenant capable schema
- Real-time updates (WebSocket or SSE)
- Export capabilities (CSV, PDF reports)
- Email notifications (when SMTP available)

### Docker Strategy
- **Staging container:** Always running on `0.0.0.0:4100` (stable)
- **Dev container:** Sprint work on `0.0.0.0:4101` (current sprint)
- When sprint passes all tests → promote dev to staging
- Docker Compose with shared volume for SQLite data

### Sustainable Development Patterns
- **AGENTS.md** in repo — instructions for Claude Code sub-agents
- **Small, focused files** — each under 300 lines for context window efficiency
- **Comprehensive test coverage** — Playwright E2E + unit tests
- **Adversarial testing** — Codex writes tests, Claude Code writes code
- **Feature flags** — gradual rollout, easy rollback
- **Conventional commits** — automated changelog
- **Sprint branches** — `sprint/YYYY-MM-DD-description`

### Context Sustainability
To keep Claude Code effective long-term:
1. Each module is self-contained with its own README
2. AGENTS.md provides full project context in <2000 tokens
3. Tests serve as living documentation
4. Changelog tracks all decisions
5. Each sprint has a focused scope (1-3 features)

## Sprint Cadence
- Daily sprints with clear scope
- 30-min heartbeat checks on progress
- Sprint completion → test → promote to staging
- Post-sprint analysis → plan next sprint
- Daily report to Ciprian

## Directory Structure
```
ideate/
├── PROJECT.md           # This file
├── AGENTS.md            # Instructions for AI agents
├── CHANGELOG.md         # Keep a Changelog format
├── docker-compose.yml   # Multi-container setup
├── Dockerfile           # Multi-stage production build
├── package.json
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # React components
│   ├── lib/             # Shared utilities
│   ├── db/              # Database schema, migrations
│   └── types/           # TypeScript types
├── tests/
│   ├── e2e/             # Playwright E2E tests
│   └── unit/            # Vitest unit tests
└── docs/
    ├── architecture.md  # Technical decisions
    ├── api.md           # API documentation
    └── sprints/         # Sprint logs
```

## Phase Plan

### Phase 1: Foundation (Sprint 1-3)
- Project scaffolding, Docker setup
- Database schema + migrations
- Basic auth flow (WorkOS)
- Core UI layout (responsive, dark mode)

### Phase 2: Core Features (Sprint 4-8)
- Projects CRUD
- Proposals with voting
- Accordion visualization with bar charts
- Comments (threaded)
- Similarity detection

### Phase 3: Enterprise (Sprint 9-15)
- AI summarization (pluggable)
- Role-based access
- Audit logging
- Real-time updates
- Export capabilities
- Email notifications

### Phase 4: Polish & Perpetual (Sprint 16+)
- Performance optimization
- Accessibility audit
- Security hardening
- UX improvements
- New features based on usage patterns

## Ports
- Staging: `0.0.0.0:4100`
- Dev: `0.0.0.0:4101`
