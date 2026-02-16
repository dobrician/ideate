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

---

## Sprint 5 — CI/CD & Infrastructure (2026-02-16)
**Status:** ✅ COMPLETE

### Goals
- [x] GitHub Actions CI/CD pipeline — lint, typecheck, test, build on PR (#11)
- [x] Full-text search for projects and proposals (#10)
- [x] Audit logging — track user actions, votes, changes (#9)
- [x] Docker volume backup strategy (#3)
- [x] Email deliverability verification — SPF/DKIM headers (#2)
- [x] Internationalization setup (EN/RO) — from original ideator
- [x] API documentation (OpenAPI/Swagger for API routes)
- [x] Performance optimization — lazy loading, code splitting, image optimization

### Outcomes
- 1 conventional commit (sprint)
- All unit tests passing (260+ tests)
- Build clean, zero TypeScript errors
- GitHub Actions CI/CD (fixes #11)
  - 4 parallel jobs: lint, typecheck, test, build
  - Build depends on all checks passing
  - Node 22 with npm cache
- Full-text search via SQLite FTS5 (fixes #10)
  - FTS5 virtual tables for projects and proposals
  - Auto-sync triggers for insert/update/delete
  - Search API at `/api/search?q=<query>`
  - Search bar in header with debounced input, dropdown results
  - Fallback to LIKE queries if FTS unavailable
- Audit logging (fixes #9)
  - `audit_logs` table with userId, action, entity, entityId, details, ipAddress
  - Fire-and-forget logging in all 8 server actions
  - Auto-migration system for new DB tables
- Docker backup/restore (fixes #3)
  - `scripts/backup.sh` — timestamped SQLite backup via `.backup`
  - `scripts/restore.sh` — integrity check, restore, health wait
- Email deliverability (fixes #2)
  - SPF/DKIM/MX DNS checker (`src/lib/email-deliverability.ts`)
  - API endpoint `/api/email/deliverability`
  - Full setup documentation in wiki
- i18n — EN/RO
  - 80+ translation keys for all UI text
  - Server-side locale from cookie, client-side `useLocale` hook
  - Locale switcher in header (EN/RO toggle)
  - Sidebar navigation translated
- OpenAPI 3.1 specification (`docs/openapi.yaml`)
  - All API routes documented with schemas
- Performance
  - Bundle analyzer (`npm run analyze`)
  - lucide-react tree-shaking via optimizePackageImports
  - Dynamic import for sidebar (code splitting)
  - Image optimization config (AVIF/WebP)
  - Inter font with latin-ext for Romanian

### Notes
- GitHub issues #2, #3, #9, #10, #11 addressed
- ESLint config fixed for Next.js 16 + ESLint 9 compatibility
- Auto-migration system ensures seamless DB schema updates on startup

---

## Sprint 6 — PWA, Export & Quality (2026-02-16)
**Status:** ✅ COMPLETE

### Goals
- [x] PDF/CSV export for project reports (#7)
- [x] PWA support — service worker, manifest, offline mode (#12)
- [x] Comprehensive E2E tests for all user flows (auth, projects, proposals, voting, comments)
- [x] Security hardening — rate limiting on auth endpoints, input sanitization
- [x] Notification system — email notifications for votes and comments on user's proposals
- [x] Project deadlines — countdown, auto-close voting when deadline passes
- [x] Admin panel — user management, system stats
- [x] SEO — meta tags, Open Graph, sitemap.xml

### Outcomes
- 1 conventional commit (sprint)
- All unit tests passing (390 tests, up from 260)
- Build clean, zero TypeScript errors
- PDF/CSV export (fixes #7)
  - API route `GET /api/projects/[id]/export?format=pdf|csv`
  - HTML report with vote charts, stats, and comments
  - CSV tabular export for spreadsheet analysis
  - Export buttons on project detail page
- PWA support (fixes #12)
  - Web manifest, service worker, offline fallback page
  - Install prompt banner for mobile/desktop
  - SVG app icon
- Comprehensive E2E tests (Playwright)
  - Auth flow: login page, form validation, protected route redirects
  - Navigation: homepage content, header, 404, public assets
  - API: search, export auth, health, rate limiting verification
  - Security: CSP headers, X-Frame-Options, admin access control
- Security hardening
  - Rate limiting on `/auth/request` (5/email, 20/IP per 15 min)
  - Input sanitization library (HTML escape, tag stripping)
  - CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Email notifications
  - Vote and comment notifications to proposal owners
  - 15-minute debounce to prevent spam
  - Fire-and-forget (never breaks app flow)
- Project deadlines
  - Live countdown timer (days:hours:minutes:seconds)
  - Auto-close voting and commenting after deadline
  - "Voting Closed" badge and urgent styling
- Admin panel (`/admin`)
  - User management with inline role editing
  - System stats (users, projects, proposals, votes)
  - Audit log viewer (last 20 entries)
  - Admin sidebar link (role-aware)
  - `/api/me` endpoint
- SEO
  - Dynamic `generateMetadata` on project pages
  - `robots.txt`, dynamic `sitemap.xml`
  - JSON-LD structured data
  - Open Graph meta tags
- New unit tests: rate-limit (6), sanitize (11), export (12) = 29 new tests

### Notes
- GitHub issues #7 and #12 addressed in this sprint
- 390 total unit tests, all passing
- Build clean with all new routes verified
- E2E test suite covers auth, navigation, API, and security flows

---

## Sprint 7 — Quality, Testing & Refinement (2026-02-16)
**Status:** 🔄 IN PROGRESS

### Goals
- [ ] Fix any TypeScript/build errors from Sprint 4-6 features
- [ ] Comprehensive test coverage audit — fill gaps to reach 100%
- [ ] Visual polish — consistent spacing, typography, animations
- [ ] Accessibility audit — WCAG 2.1 AA compliance
- [ ] Error boundary improvements — graceful error recovery
- [ ] Loading skeleton improvements for all async pages
- [ ] Database index optimization for common queries
- [ ] Code cleanup — remove dead code, consolidate utilities

### Outcomes
- TBD (sprint in progress)
