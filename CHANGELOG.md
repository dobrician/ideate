# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
