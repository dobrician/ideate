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
**Status:** ✅ COMPLETE

### Goals
- [x] Email magic link auth (send link, verify, create session)
- [x] JWT session management (HTTP-only cookies) — with CSRF protection + token rotation (fixes #5)
- [x] Login/register pages
- [x] Projects CRUD (create, list, view, edit, delete)
- [x] Basic routing structure
- [x] README.md with setup instructions
- [x] Smoke test suite (`npm run test:smoke`)

### Outcomes
- 7 conventional commits
- All unit tests passing (20 tests total, 100% auth coverage)
- Email magic link authentication fully implemented
  - SMTP integration with nodemailer (configurable provider)
  - JWT with 15m expiry for magic links, 7d for sessions
  - Enhanced JWT security (fixes #5): CSRF protection, token rotation, jti, audience validation
  - Automatic token rotation when <3 days remain until expiry
  - CSRF token cookie + strict SameSite cookies for CSRF protection
  - Email enumeration attack prevention
- Auth pages and routes complete
  - Login page (`/auth/login`) with email form and validation
  - Verification page (`/auth/verify`) with token validation and session creation
  - Request route (`POST /auth/request`) and logout route (`POST /auth/logout`)
  - Loading and error boundaries for all auth pages
- Projects CRUD fully functional
  - List page (`/projects`) with grid view and status badges
  - Create page (`/projects/new`) with form validation (zod)
  - Detail page (`/projects/[id]`) with view and edit/delete options
  - Edit page (`/projects/[id]/edit`) with update form
  - Delete functionality with confirmation dialog
  - Server actions for all mutations (create, update, delete)
  - API route GET `/api/projects/[id]` for fetching single project
  - Auth checks and ownership validation (only owner/admin can edit/delete)
  - Loading states and error handling throughout
- Smoke test suite created
  - 8 comprehensive tests for post-deploy verification
  - Tests: homepage, health endpoint, login page, static assets, env vars, auth requirements, error handling
  - Separate Playwright config (`playwright.smoke.config.ts`)
  - Run with: `APP_URL=http://idea.surmont.co/ npm run test:smoke`
- Documentation fully updated
  - CHANGELOG.md updated with v0.2.0 release notes
  - .env.example updated (removed WorkOS, added SMTP/JWT config)
  - Sprint Log updated and ready for GitHub Wiki sync

### Notes
- GitHub issue #5 (JWT session security) fully addressed and closed
- All tests passing, zero regressions
- Ready for staging deployment and smoke test verification
- Next sprint can focus on proposals, voting, and comments

---

## Sprint 3 — Proposals & Voting (2026-02-15)
**Status:** 🔄 IN PROGRESS

### Goals
- [ ] Proposals CRUD (create, list, view per project)
- [ ] Voting system (pro/contra, +1/-1 per user per proposal)
- [ ] Vote bar chart visualization (consensus view)
- [ ] Threaded comments on proposals
- [ ] AI summarization integration (Gemini/OpenAI pluggable)
- [ ] Protected routes (auth middleware — redirect to login if not authenticated)
- [ ] User profile/settings page
- [ ] Address #1: SQLite WAL mode + concurrent write safety for voting

### Outcomes
- TBD (sprint in progress)
