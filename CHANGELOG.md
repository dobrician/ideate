# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
