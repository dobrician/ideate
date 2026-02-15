# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
