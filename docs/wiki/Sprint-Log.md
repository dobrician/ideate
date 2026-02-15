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

## Sprint 4 — Polish & Enterprise Features (2026-02-16)
**Status:** ✅ COMPLETE

### Goals
- [x] Role-based access control — admin/member roles with permissions (#8)
- [x] Real-time voting updates via SSE (#6)
- [ ] Email deliverability — verify SPF/DKIM setup (#2) — deferred to Sprint 5
- [x] AI rate limiting and cost controls (#4)
- [x] Responsive mobile UI polish
- [x] Error handling improvements (toast notifications, better error pages)
- [x] Dashboard page (overview of user's projects, recent activity)
- [x] Pagination for projects and proposals lists

### Outcomes
- 1 conventional commit (squashed sprint)
- All unit tests passing (260 tests total, up from 125)
- Build clean, zero TypeScript errors
- RBAC library with 4 roles and 13 permissions (fixes #8)
  - admin: full access + manage all projects
  - manager: CRUD + delete proposals, no user management
  - member: create, vote, comment (cannot delete others' content)
  - viewer: read-only (cannot vote, comment, or create)
  - Permission checks enforced in all 8 server actions
- Real-time voting via SSE (fixes #6)
  - SSE endpoint `/api/votes/stream?projectId=xxx`
  - In-process event emitter with per-project subscribers
  - Client hook `useVoteStream` with auto-reconnect on error
  - ProposalList receives live vote count updates
- AI rate limiting with cost tracking (fixes #4)
  - Configurable hourly limits: requests (60) and tokens (100K)
  - Per-provider cost tracking (Gemini + OpenAI rates)
  - `getAiUsageStats()` API for monitoring
  - Sliding-window hourly reset
- Dashboard page (`/dashboard`)
  - 4 platform-wide stat cards (projects, proposals, votes, comments)
  - User's projects + proposals lists
  - Recent votes with +1/-1 badges
  - Activity feed (latest comments)
  - Loading skeleton + error boundary
- Toast notifications (Sonner via shadcn/ui)
  - All mutations show success/error toasts
  - Integrated in: proposals, projects, profile, voting, comments, delete
- Pagination on projects list (12 per page)
  - Page navigation with prev/next + page numbers
  - Total count display
- Error handling improvements
  - Global 404 page with navigation
  - Global error boundary with retry + home links
  - Removed `any` type from edit project page
- Mobile responsive polish
  - Flex-wrap headers and controls
  - Responsive grids (320px+ compatible)
  - Proper touch targets and spacing
- New tests: RBAC (100), vote-events (18), LLM rate limiting (17)
- Updated home page with feature cards and CTAs
- Dashboard added to sidebar navigation

### Notes
- GitHub issues #4, #6, #8 addressed in this sprint
- Issue #2 (email deliverability) deferred — requires DNS config, not code
- 260 total unit tests, all passing
- Build clean, ready for staging deployment
