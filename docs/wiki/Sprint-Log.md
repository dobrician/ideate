# Sprint Log

## Sprint 1 — Foundation (2026-02-15)
**Status:** ✅ COMPLETE

### Goals
- [x] Project scaffolding, repo setup, documentation
- [x] Next.js 16 with TypeScript strict, Tailwind CSS 4
- [x] Drizzle ORM + SQLite schema (5 tables)
- [x] Database migrations
- [x] Docker multi-stage build (staging :4100, dev :4101)
- [x] Basic layout (responsive shell, dark mode, header, sidebar)
- [x] shadcn/ui (11 components)
- [x] Playwright smoke tests (2 passing)
- [x] Vitest unit test (1 passing)
- [x] Health check endpoint (`/api/health`)
- [x] .env.example

### Outcomes
- 9 conventional commits
- Build, unit tests, E2E tests all passing
- Docker container builds and serves
- Schema: users (with roles), projects, proposals, votes (composite PK), comments (threaded)
- Dark mode with light/dark/system toggle

### Notes
- Switched from WorkOS to email magic link auth
- SMTP via smtp2go (See .env.local)
- Domain: idea.surmont.co via nginx proxy

---

## Sprint 2 — Auth & Core Features (2026-02-15)
**Status:** 🔄 IN PROGRESS

### Goals
- [x] Email magic link auth (send link, verify, create session)
- [x] JWT session management (HTTP-only cookies) — with CSRF protection + token rotation (fixes #5)
- [x] Login/register pages
- [x] Projects CRUD (create, list, view) — server actions implemented
- [ ] Basic routing structure
- [x] README.md with setup instructions
- [x] Smoke test suite (`npm run test:smoke`) — staging deployment verification

### Outcomes (so far)
- JWT security with CSRF protection and token rotation (closes #5)
- Login page with magic link flow
- Auth routes implemented
- .env.example updated with SMTP and JWT config
- Projects CRUD with server actions (create, list, view)
- Smoke test suite for post-deploy verification
