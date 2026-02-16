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
**Status:** ✅ COMPLETE

### Goals
- [x] Proposals CRUD (create, list, view per project)
- [x] Voting system (pro/contra, +1/-1 per user per proposal)
- [x] Vote bar chart visualization (consensus view)
- [x] Threaded comments on proposals
- [x] AI summarization integration (Gemini/OpenAI pluggable)
- [x] Protected routes (auth middleware — redirect to login if not authenticated)
- [x] User profile/settings page
- [x] Address #1: SQLite WAL mode + concurrent write safety for voting

### Outcomes
- 6 conventional commits
- All unit tests passing, build clean
- Proposals CRUD fully implemented
  - Create proposal with AI-generated summary (Gemini/OpenAI)
  - Delete proposal (owner/admin, cascading to votes/comments)
  - Accordion-based list with vote buttons and discussion sheets
  - Server actions: createProposal, deleteProposal, castVote, removeVote, addComment
- Voting system complete
  - +1/-1 per user per proposal with composite PK
  - Upsert on conflict for vote changes
  - Toggle removal (click same vote again)
  - ThumbsUp/ThumbsDown with green/red active state highlighting
- Vote bar chart visualization
  - Horizontal pro/contra bar with percentages (pure CSS/Tailwind)
  - Green for pro, red for contra, counts and percentages
- Threaded comments
  - Discussion sheet (shadcn Sheet) per proposal with comment count
  - Reply threading via parentId, max depth 3
  - Relative time display (e.g., "2h ago")
- AI summarization library
  - Pluggable LLM: Gemini primary (gemini-2.5-flash-lite), OpenAI fallback (gpt-4o-mini)
  - Per-provider 15-min throttling on 429 (addresses #4)
  - Direct REST API calls, no SDK dependency
  - Project and proposal summary generation with fallback truncation
- Auth middleware (`src/middleware.ts`)
  - Route-level protection, redirects to /auth/login with redirect param
  - Public routes excluded: /, /auth/*, /api/health, static assets
- User profile page (`/profile`)
  - Account info, edit name, user's projects and proposals
  - Loading skeleton and error boundary
- Navigation updates
  - Real sidebar nav: Home, Projects, Profile, Sign Out
  - Header with profile icon link
- SQLite concurrent writes fixed (fixes #1)
  - busy_timeout=5000 pragma for write contention

### Notes
- GitHub issue #1 (SQLite concurrent writes) closed
- GitHub issue #4 (AI rate limiting) addressed with throttling
- CHANGELOG.md updated with v0.3.0
- All 8 sprint tasks completed

---

## Sprint 11 — Critical UX Fixes (2026-02-16)
**Status:** IN PROGRESS

### Goals
- [x] 1. Fix logout — clear session properly, redirect to clean page with no sidebar
- [x] 2. Auth pages minimal layout — no sidebar, no logged-in nav
- [x] 3. Locale persistence — persist in cookie, survive navigation
- [x] 4. Missing Romanian translations — all reported strings
- [x] 5. Admin 403 — proper Access Denied page
- [x] 6. PWA install popup — show once per session
- [x] 7. Voting UX — highlight selected vote, tooltip to remove
- [x] 8. Delete confirmation — modal dialog for destructive actions
- [x] 9. Search — functional search with results dropdown
- [x] 10. Date format — localize to dd.mm.yyyy for RO
- [ ] 11. Dark mode contrast — WCAG AA compliance
- [ ] 12. Tooltips — title/tooltip on all icon buttons
