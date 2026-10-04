# Ideate — Democratic Idea Prioritization

A platform for teams to create projects, submit proposals, vote (pro/contra), and discuss through threaded comments. AI-powered summaries help surface consensus.

🌐 **Production:** [ideate.surcod.ro](https://ideate.surcod.ro) · **Isolated test:** [test.ideate.surcod.ro](https://test.ideate.surcod.ro)

The legacy `idea.surmont.co` host permanently redirects to production with path and query preserved. This branch runs only on the test host; production retains the accepted decision-screen release and its database. See [runtime separation and rollback](ops/README.md).

Ideate uses the Convergence symbol with a lowercase wordmark and a floating navigation bar. Projects, search and account stay visible on desktop and mobile; the sun/moon theme control stays visible in the bar and language lives in the account menu. Below 360px only the brand symbol is shown, preserving 44px controls without overflow. The project-return link is in this shared navigation, and the duplicated mobile bottom bar is no longer mounted. Favicons and install icons use the same identity. The Docker dependency stage includes native SQLite compilation tools when prebuilt binaries cannot be downloaded. Background project updates continue without a visible Live Activity or connection-status panel.

## Decision workflow

The accepted project screen and its interactions remain in **code freeze**. This test branch implements the approved [user-experience simplification](docs/design/User-Experience-Review.md): Projects is the single home, `/dashboard` redirects there, and the project list offers current decisions and an archive. Account settings show identity and name, with security and email preferences available on demand. SurCod SSO is the primary login; password/magic-link fallback remains available deliberately. Search has one query and keyboard navigation without retrieval-mode controls. Intrusive onboarding and install prompts are no longer mounted; existing offline/update infrastructure is retained.

Signed-in users start with projects. Each project card shows its AI summary, proposal count, votes and deadline. Inside a project, the decision summary and participation totals come first, followed by compact idea titles and pro/contra votes. Proportional green/red chart fills form each idea card background, clipped to its rounded corners; the chart keeps the compact header height during previews and expansion, with a smooth 16px gradient into the detail body. The first idea previews its vertically centered AI summary; mouse movement or keyboard focus transfers the preview to another idea, and leaving the list retains it. A hand cursor and delayed elastic 4px peek suggest details without arrows or list reflow; open it for the original description and categories. The author appears below the top-right controls when expanded. Discussion and attachments open independently from the card controls. The new-idea drawer keeps its submission footer visible while fields scroll, with a roomier context editor, quiet vote choices and optional categories. The approved forest/sage and clay palette uses shared semantic colors for Pro/Contra chart fills, selected votes, proposal creation and duplicate review, calibrated separately for light and dark. Primary actions use the matching theme foreground; own chat messages use quiet sage surfaces with contrasting text; received messages have a distinct neutral background and border. Inline Markdown inherits the bubble text color in both themes. Inactive or expired projects use reduced contrast and show vote totals without contribution controls; existing project discussion remains readable.

Expanded project context replaces the AI summary, with participation and its disclosure in one footer; creation and update dates are omitted. The project uses a solid background to distinguish it from transparent idea cards. The proposal toolbar is removed: sorting, filters, export, editing and AI tools are in the project actions menu, and the compact + button opens proposal creation. The account menu provides account preferences and role-restricted administration; global search opens from the search icon or Ctrl/Cmd+K. Project creation asks only for the decision, context and deadline; it creates an active project. Existing categories, status actions and backend tools remain available to their existing consumers. Shared links use the same compact decision view.

On mobile, proposal titles and controls share one compact row with 44px touch targets. Descriptions open by tapping the title; the persistent summary preview remains on desktop. This responsive adjustment is reviewed on the isolated test host (#89).

The isolated preview has completed an adversarial Opus 5.5 polish cycle: dependable keyboard/logout/search, three-line project summaries, recoverable account forms and compact Projects pagination. Production retains its accepted release. See [review decisions](docs/design/Adversarial-Preview-Review.md) for verification scope and deferred items.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict
- **Database:** SQLite + Drizzle ORM (WAL mode, FTS5 search)
- **Auth:** SurCod SSO exclusively (OIDC + PKCE), JWT application sessions
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
# Edit .env.local with your SSO configuration, JWT_SECRET, and optional SMTP/AI keys

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
- `SMTP_*` — Optional email provider for notifications; authentication sends no email
- `GEMINI_API_KEY` / `OPENAI_API_KEY` — AI summarization
- `APP_URL` — Public URL (e.g., `https://ideate.surcod.ro`)

### SurCod SSO and shared projects

`/p/<share-token>` is publicly readable. Voting, proposals and comments require authentication; following the link after login grants membership of that project. The SSO flow preserves this destination and returns the participant to the project.

Configure `OIDC_ISSUER=https://sso.surcod.ro`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and an exact `OIDC_REDIRECT_URI=<APP_URL>/api/auth/oidc/callback` for a confidential web client using `client_secret_post`. Ideate uses Authorization Code with PKCE S256 and requires a verified email before creating or linking an identity. Roles remain managed by Ideate.

SSO is the only sign-in path. `/auth/login` redirects directly to `/api/auth/oidc`, then to `https://sso.surcod.ro`; the provider offers its configured authentication methods. Ideate has no registration, magic-link, password recovery, credential forms or local email/password settings. A failed provider flow shows only a retry and preserves the safe return destination. No public build flag is needed. Supply the confidential OIDC credentials only at runtime, with the exact callback registered separately for production and test.

Existing accounts, roles and explicit OAuth identity mappings are retained. Legacy credential/token columns are preserved as inactive data, without destructive migrations. On rollout, existing application cookies require one fresh SSO login; new sessions are explicitly marked as SSO-issued. Application logout clears/revokes the Ideate session and returns to its public home without logging the user out of other SSO applications.

Automated application tests use isolated fixture sessions only when `E2E_TEST_ENABLED=true`, a secret is configured, and `APP_URL` is a loopback origin. Public production/test origins reject the fixture endpoint even if a secret is accidentally supplied. Provider authentication is verified separately through the real OIDC flow; tests never send authentication email.

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

Operational continuity and the isolated SurCod holiday demo are documented in [HANDOVER.md](HANDOVER.md). Access credentials remain in private host state, outside the repository; demo resets never use the global seed.

## License

Private — SurCod SRL
