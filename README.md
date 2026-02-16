# Ideate — Democratic Idea Prioritization

A platform for teams to create projects, submit proposals, vote (pro/contra), and discuss through threaded comments. AI-powered summaries help surface consensus.

🌐 **Staging:** [idea.surmont.co](https://idea.surmont.co)

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict
- **Database:** SQLite + Drizzle ORM (WAL mode, FTS5 search)
- **Auth:** Email magic link + JWT sessions
- **UI:** Tailwind CSS 4 + shadcn/ui
- **Testing:** Vitest (unit) + Playwright (E2E + smoke)
- **AI:** Pluggable LLM (Gemini / OpenAI) for summarization
- **Deploy:** Docker multi-stage build
- **CI/CD:** GitHub Actions (lint, typecheck, test, build)
- **i18n:** English + Romanian with locale switcher

## Quick Start

```bash
# Clone
git clone https://github.com/dobrician/ideate.git
cd ideate

# Configure
cp .env.example .env.local
# Edit .env.local with your SMTP, JWT_SECRET, and AI keys

# Run with Docker (recommended)
docker compose up staging -d

# Or run locally
npm install
npm run db:migrate
npm run dev
```

## Docker

| Service  | Port | Purpose |
|----------|------|---------|
| staging  | 4100 | Stable release, always running |
| dev      | 4101 | Current sprint work |

```bash
docker compose up staging -d    # Start staging
docker compose up dev -d        # Start dev
docker compose build            # Rebuild images
```

### Backup & Restore

```bash
./scripts/backup.sh staging           # Backup staging DB
./scripts/backup.sh dev ./my-backups  # Backup dev DB to custom dir
./scripts/restore.sh staging ./backups/ideate-staging-20260216.db  # Restore
```

## Testing

```bash
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
npm run test:smoke    # Smoke tests against live staging
npm run analyze       # Bundle size analysis
```

**Coverage target: 100%** — no exceptions.

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

Key ones:
- `JWT_SECRET` — Generate with `openssl rand -base64 32`
- `SMTP_*` — Email provider for magic links
- `GEMINI_API_KEY` / `OPENAI_API_KEY` — AI summarization
- `APP_URL` — Public URL (e.g., `https://idea.surmont.co`)

## Project Structure

```
src/
├── app/           # Next.js App Router pages & API routes
├── components/    # React components (ui/ for shadcn)
├── db/            # Drizzle schema & migrations
├── lib/           # Shared utilities (auth, mail, ai, i18n, search, audit)
docs/
├── openapi.yaml   # OpenAPI 3.1 API specification
├── wiki/          # GitHub Wiki source files
scripts/
├── backup.sh      # Docker volume backup
├── restore.sh     # Docker volume restore
tests/
├── unit/          # Vitest unit tests
├── e2e/           # Playwright E2E tests
├── smoke/         # Post-deploy smoke tests
```

## API Documentation

See [`docs/openapi.yaml`](docs/openapi.yaml) for the full OpenAPI 3.1 specification.

Key endpoints:
- `GET /api/health` — System health check (public)
- `GET /api/search?q=<query>` — Full-text search (auth required)
- `GET /api/projects/:id` — Get project details (auth required)
- `GET /api/projects/:id/export?format=pdf|csv` — Export report (auth required)
- `GET /api/votes/stream?projectId=<id>` — Real-time vote SSE stream (auth required)
- `GET /api/me` — Current user info (auth required)
- `GET /api/email/deliverability` — SPF/DKIM/MX check (admin only)

## Data Model

- **Users** — email auth, roles (admin/manager/member/viewer)
- **Projects** — title, description, AI summary, deadline
- **Proposals** — per project, with pro/contra voting
- **Votes** — composite PK (proposal + user), +1/-1
- **Comments** — threaded (parentId), per proposal
- **Audit Logs** — user action tracking (action, entity, details)

## Features

- **RBAC** — 4 roles with 13 granular permissions
- **Real-time voting** — SSE-based live vote count updates
- **AI summaries** — Gemini/OpenAI for project and proposal summaries
- **Full-text search** — SQLite FTS5 across projects and proposals
- **Audit logging** — track all user actions
- **i18n** — English and Romanian with locale switcher
- **Dashboard** — personal overview with stats and activity feed
- **PDF/CSV export** — project reports with proposals, votes, and comments
- **PWA** — offline support, install prompt, service worker
- **Admin panel** — user management, system stats, audit log viewer
- **Project deadlines** — countdown timer, auto-close voting
- **Email notifications** — vote and comment alerts for proposal owners
- **Security** — rate limiting, input sanitization, CSP, security headers
- **SEO** — Open Graph, sitemap.xml, JSON-LD structured data

## Contributing

See [AGENTS.md](AGENTS.md) for development guidelines, architecture rules, and commit conventions.

## License

Private — SurCod SRL
