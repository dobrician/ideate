# Ideate — Democratic Idea Prioritization

A platform for teams to create projects, submit proposals, vote (pro/contra), and discuss through threaded comments. AI-powered summaries help surface consensus.

🌐 **Staging:** [idea.surmont.co](https://idea.surmont.co)

## Decision workflow

Signed-in users start with projects. Each project card shows its AI summary, proposal count, votes and deadline. Inside a project, the decision summary and participation totals come first, followed by compact idea titles and pro/contra votes. Hover or focus an idea to reveal its AI summary with a short expansion animation; open it for the original description and categories. The author appears at the top right when expanded. Discussion and attachments open independently from the card controls. Inactive or expired projects use reduced contrast and show vote totals without contribution controls; existing project discussion remains readable.

Context, timestamps, filters, export, editing and AI tools are revealed on request. The account menu provides access to the personal dashboard and administration; global search opens from the search icon or Ctrl/Cmd+K. Project creation starts with a title, context and deadline, with templates, status and categories under **More options**. Shared links use the same compact decision view.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict
- **Database:** SQLite + Drizzle ORM (WAL mode, FTS5 search)
- **Auth:** SurCod SSO (OIDC + PKCE), email/password and magic-link fallback, JWT sessions
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

Use `NEXT_DIST_DIR=.next-e2e` for an additional development server running tests while a preview is open; each server also needs its own `DATABASE_URL` and port. Never enable `E2E_TEST_SECRET` on the public deployment or the demo preview.

When testing a production image, use HTTPS: Safari correctly rejects production `Secure` session cookies over plain HTTP. `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true` is available only for an isolated local HTTPS test server with a self-signed certificate; certificate validation remains enabled by default and for live smoke tests.

Install the browser engines used by the desktop, Android and iOS projects before the first E2E run:

```bash
npx playwright install --with-deps chromium webkit
```

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

### SurCod SSO and shared projects

`/p/<share-token>` is publicly readable. Voting, proposals and comments require authentication; following the link after login grants membership of that project. The SSO flow preserves this destination and returns the participant to the project.

Configure `OIDC_ISSUER=https://sso.surcod.ro`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and an exact `OIDC_REDIRECT_URI=<APP_URL>/api/auth/oidc/callback` for a confidential web client using `client_secret_post`. Ideate uses Authorization Code with PKCE S256 and requires a verified email before creating or linking an identity. Roles remain managed by Ideate.

Set `NEXT_PUBLIC_OIDC_ENABLED=true` for development. For containers, compile the public login button with `NEXT_PUBLIC_OIDC_ENABLED=true docker compose build staging`, or `podman build --build-arg NEXT_PUBLIC_OIDC_ENABLED=true -t ideate-staging .`. Client secrets are supplied only at runtime. Production and development use separate OIDC applications and credentials in **1Password → Surmont → SurCod — Ideate Web / Ideate Development — ZITADEL OIDC**. The user login is saved as **Ideate — SurCod SSO**.

The existing SurCod identity `dc@surcod.ro` is explicitly linked to the demo owner `ciprian.dobrea@gmail.com`; its existing Google identity can also authenticate through SSO. Other participants need an account available in SurCod SSO, or may use Ideate's existing email authentication. This integration does not change the SSO registration policy.

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
