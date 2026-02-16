# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-02-16

### Added
- PDF/CSV export for project reports (fixes #7)
  - API route `GET /api/projects/[id]/export?format=pdf|csv`
  - HTML report with vote charts, proposals, and comments
  - CSV export with all project data in tabular format
  - Export buttons on project detail page
- Progressive Web App (PWA) support (fixes #12)
  - Web manifest (`public/manifest.json`) with app metadata
  - Service worker (`public/sw.js`) with offline caching
  - Offline fallback page (`public/offline.html`)
  - Install prompt banner component
  - SVG app icon
- Email notifications for votes and comments
  - Proposal owners notified when their proposals receive votes
  - Proposal owners notified when comments are added
  - Debounced notifications (max 1 per proposal per 15 minutes)
  - Fire-and-forget: never breaks application flow
- Project deadline countdown and auto-close
  - Live countdown timer component (days, hours, minutes, seconds)
  - Voting and commenting blocked after deadline passes
  - "Voting Closed" badge for expired projects
  - Urgent styling when deadline is imminent
- Admin panel (`/admin`)
  - Admin-only access with RBAC enforcement
  - User management with inline role editing
  - System stats dashboard (users, projects, proposals, votes)
  - Audit log viewer showing recent 20 entries
  - Admin link in sidebar (visible only to admins)
  - `GET /api/me` endpoint for current user info
- SEO improvements
  - Dynamic `generateMetadata` on project pages (title, description, Open Graph)
  - `robots.txt` with sitemap reference
  - Dynamic `sitemap.xml` listing all projects
  - JSON-LD structured data (WebApplication schema)
  - Canonical metadata in root layout
- Comprehensive E2E tests (Playwright)
  - Auth flow tests (login page, form validation, protected routes)
  - Navigation tests (homepage, header, 404, public assets)
  - API endpoint tests (search, export, health, rate limiting)
  - Security header tests (CSP, X-Frame-Options, CORS)
- Unit tests for new modules
  - Rate limiter tests (6 tests)
  - Input sanitization tests (11 tests)
  - Export generation tests (12 tests)

### Security
- Rate limiting on `/auth/request` endpoint
  - Max 5 requests per email per 15 minutes
  - Max 20 requests per IP per 15 minutes
  - Returns 429 with Retry-After header
- Input sanitization library (`src/lib/sanitize.ts`)
  - HTML entity escaping, tag stripping, object sanitization
- Security headers via middleware
  - Content-Security-Policy (CSP) with strict directives
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()

### Changed
- Sidebar now shows Admin link for admin users
- i18n translations extended with admin navigation key
- Middleware updated with security headers and PWA public paths

## [0.5.0] - 2026-02-16

### Added
- GitHub Actions CI/CD pipeline (fixes #11)
  - Lint, type check, unit test, and build jobs on every push/PR
  - Node 22 with npm cache, parallel job execution
  - Build job depends on lint + typecheck + test passing
- Full-text search for projects and proposals using SQLite FTS5 (fixes #10)
  - FTS5 virtual tables with automatic sync triggers
  - Search API endpoint `GET /api/search?q=<query>`
  - Search bar component in header with debounced input and dropdown results
  - Falls back to LIKE queries if FTS tables unavailable
- Audit logging for all user actions (fixes #9)
  - `audit_logs` table: userId, action, entity, entityId, details, ipAddress
  - Fire-and-forget logging in all server actions (create, update, delete, vote, comment)
  - Auto-migration system for new database tables
- Docker volume backup/restore scripts (fixes #3)
  - `scripts/backup.sh` — consistent SQLite backup via `.backup` command
  - `scripts/restore.sh` — restore with integrity check, container restart, health wait
  - Support for both staging and dev environments
- Email deliverability verification (fixes #2)
  - `src/lib/email-deliverability.ts` — SPF, DKIM, MX record checker
  - API endpoint `GET /api/email/deliverability` for domain verification
  - Documentation: `docs/wiki/Email-Deliverability.md` with setup instructions
- Internationalization (i18n) — EN/RO support
  - Translation library (`src/lib/i18n.ts`) with 80+ keys in English and Romanian
  - Server-side locale detection from cookie (`src/lib/i18n-server.ts`)
  - Client-side `useLocale` hook for components
  - Locale switcher button (EN/RO toggle) in header
  - Sidebar navigation uses translated strings
  - Root layout sets `<html lang>` from locale
- API documentation (OpenAPI 3.1 specification)
  - `docs/openapi.yaml` covering all API routes
  - Schemas for all request/response types
  - Authentication, search, health, SSE, email endpoints documented
- Performance optimizations
  - Bundle analyzer (`npm run analyze`) via `@next/bundle-analyzer`
  - `optimizePackageImports` for lucide-react tree-shaking
  - Dynamic import for sidebar (client-side code splitting)
  - Next.js Image optimization config (AVIF + WebP formats)
  - Inter font with latin-ext subset for Romanian characters

### Changed
- ESLint config updated: `eslint-config-next/core-web-vitals` native flat config (fixes ESLint 9 compatibility)
- Lint script changed from `next lint` to `eslint src/` (Next.js 16 compatibility)
- Database initialization now auto-applies pending migrations on startup

## [0.4.0] - 2026-02-15

### Added
- Role-based access control (RBAC) library (`src/lib/rbac.ts`) (fixes #8)
  - Four roles: admin, manager, member, viewer
  - 13 granular permissions (project/proposal CRUD, vote, comment, user management)
  - Admin can manage all projects regardless of ownership
  - Viewer role restricted to read-only access
  - Permission checks enforced in all server actions
- Real-time voting updates via Server-Sent Events (SSE) (fixes #6)
  - SSE endpoint `GET /api/votes/stream?projectId=xxx`
  - In-process event emitter (`src/lib/vote-events.ts`) for per-project subscribers
  - Client-side `useVoteStream` hook with auto-reconnect
  - Vote counts update live in ProposalList without page refresh
- AI rate limiting with cost tracking (fixes #4)
  - Configurable per-hour request limit (`AI_MAX_REQUESTS_PER_HOUR`, default 60)
  - Configurable per-hour token limit (`AI_MAX_TOKENS_PER_HOUR`, default 100K)
  - Per-provider cost tracking (USD) based on token usage
  - `getAiUsageStats()` for monitoring current usage window
  - Sliding-window reset (hourly)
- Dashboard page (`/dashboard`)
  - Platform-wide stats (projects, proposals, votes, comments)
  - User's projects and proposals lists
  - Recent votes with pro/contra badges
  - Activity feed showing latest comments across all projects
  - Loading skeleton and error boundary
- Pagination for projects list
  - 12 items per page with page number navigation
  - Total count display and prev/next controls
  - Reusable `Pagination` component
- Toast notifications via Sonner (shadcn/ui)
  - Success/error toasts on all mutations (create, update, delete, vote, comment)
  - Rich colors, close button, bottom-right position
  - Integrated across: proposals, projects, profile, voting, comments
- Global error pages
  - Custom 404 page with navigation links
  - Global error boundary with retry and home links
  - Error digest display for debugging
- Improved home page with feature cards and navigation CTAs

### Changed
- Project detail page now uses RBAC for edit/delete visibility
- Proposal creation restricted by `proposal:create` permission
- Voting restricted by `vote:cast` permission (viewers cannot vote)
- Commenting restricted by `comment:create` permission
- Delete proposal requires `proposal:delete` (member role cannot delete)
- Sidebar navigation updated with Dashboard link
- Fixed TypeScript `any` type in project edit page (now properly typed)
- Mobile-responsive improvements across all pages
  - Flex-wrap on project detail header and status badges
  - Responsive grid layouts (320px+ compatible)
  - Proper touch targets and spacing on small screens

### Security
- RBAC enforcement on all server actions (fixes #8)
- Viewers restricted to read-only operations
- Admin bypass only via explicit `project:manage_all` permission

## [0.3.0] - 2026-02-15

### Added
- Proposals CRUD with AI-generated summaries
  - Create proposal with title, description, and initial vote
  - AI summary generation via Gemini/OpenAI on creation
  - Delete proposal (owner/admin only, cascading to votes/comments)
  - Accordion-based proposal list on project detail page
- Voting system (+1/-1 per user per proposal)
  - Composite primary key (proposalId + userId)
  - Upsert on conflict for vote changes
  - Toggle vote removal (click same vote to remove)
  - ThumbsUp/ThumbsDown buttons with active state highlighting
- Vote bar chart visualization
  - Horizontal pro/contra bar with percentages (pure CSS/Tailwind)
  - Green for pro, red for contra, with vote counts
- Threaded comments on proposals
  - Discussion sheet (shadcn Sheet) per proposal with comment count
  - Reply threading via parentId (max depth 3)
  - Relative time display (e.g., "2h ago")
- AI summarization library (`src/lib/llm.ts`, `src/lib/ai.ts`)
  - Pluggable LLM: Gemini primary, OpenAI fallback
  - Per-provider 15-min throttling on 429 responses (addresses #4)
  - Direct REST API calls (no SDK dependency)
  - Project and proposal summary generation
- Auth middleware for route protection (`src/middleware.ts`)
  - Redirects unauthenticated users to /auth/login with redirect param
  - Public routes excluded: /, /auth/*, /api/health, static assets
- User profile page (`/profile`)
  - Account info display (email, role, member since)
  - Edit first/last name form
  - Lists user's projects and proposals
  - Loading skeleton and error boundary
- Navigation updates
  - Sidebar with real nav links (Home, Projects, Profile, Sign Out)
  - Header with profile icon and Ideate home link

### Fixed
- SQLite concurrent write safety: added busy_timeout=5000 pragma (fixes #1)

## [0.2.0] - 2026-02-15

### Added
- Email magic link authentication with JWT (fixes #5: JWT session security)
  - Send magic link via SMTP (nodemailer with configurable provider)
  - Verify token and create session with HTTP-only secure cookies
  - CSRF protection with strict SameSite cookies and CSRF token
  - Automatic token rotation when <3 days remain until expiry
  - JWT security: jti for revocation, audience validation, clock tolerance
  - Minimum 32-character JWT_SECRET enforcement
- Login page (`/auth/login`) with email form and magic link request
- Auth verification page (`/auth/verify`) to handle magic link clicks
- Auth routes: POST `/auth/request`, POST `/auth/logout`
- Projects CRUD functionality
  - Projects list page (`/projects`) with grid view and status badges
  - Create project page (`/projects/new`) with form validation
  - Project detail page (`/projects/[id]`) with view and edit links
  - Project edit page (`/projects/[id]/edit`) with update form
  - Delete project functionality with confirmation dialog
  - Server actions for create, update, delete operations
  - API route GET `/api/projects/[id]` for fetching single project
  - Loading and error boundaries for all project pages
  - Auth checks on all pages and actions (owner/admin permissions)
- Smoke test suite for post-deploy verification
  - Tests homepage, health endpoint, login page, static assets
  - Verifies environment variables and database connection
  - Validates auth requirements and error handling
  - Separate Playwright config and npm script (`test:smoke`)
- Comprehensive unit tests for authentication (19 tests, 100% coverage)
- Vitest test setup file with environment variables

### Changed
- Updated `.env.example` to remove WorkOS, add SMTP and JWT config
- Enhanced auth.ts with token rotation and CSRF validation helpers

### Security
- JWT session security enhancements (addresses #5):
  - Changed SameSite from 'lax' to 'strict' for better CSRF protection
  - Added CSRF token cookie alongside session cookie
  - Implemented automatic token rotation mechanism
  - Added jti (JWT ID) for token revocation capability
  - Added audience and issuer claim validation
  - Added clock tolerance to handle time drift
- Email enumeration attack prevention (always return success)

## [0.1.0] - 2026-02-15

### Added
- Project scaffolding with architecture plan (PROJECT.md, AGENTS.md)
- Next.js 16 with TypeScript strict mode and Tailwind CSS 4
- Drizzle ORM with SQLite schema: users, projects, proposals, votes, comments
- Database migrations with WAL mode
- shadcn/ui with 11 components (Button, Card, Input, Label, Dialog, DropdownMenu, Sheet, Skeleton, Tabs, Textarea, ThemeProvider)
- Responsive layout with header, sidebar, and dark mode toggle (light/dark/system)
- Health check API endpoint (`/api/health`) with DB status
- Vitest unit testing setup with schema validation test
- Playwright E2E testing with 2 smoke tests
- Docker multi-stage build with compose (staging :4100, dev :4101)
- `.env.example` with all required environment variables
- GitHub Wiki with Architecture, Deployment, Development Guide, Testing Strategy, Sprint Log, Known Issues

### Security
- Removed hardcoded internal IPs, SMTP credentials, and database paths from public repo
- Added rule preventing test modification to hide code bugs
