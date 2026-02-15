# Ideate — Democratic Idea Prioritization

A platform for teams to create projects, submit proposals, vote (pro/contra), and discuss through threaded comments. AI-powered summaries help surface consensus.

🌐 **Staging:** [idea.surmont.co](https://idea.surmont.co)

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict
- **Database:** SQLite + Drizzle ORM (WAL mode)
- **Auth:** Email magic link + JWT sessions
- **UI:** Tailwind CSS 4 + shadcn/ui
- **Testing:** Vitest (unit) + Playwright (E2E + smoke)
- **AI:** Pluggable LLM (Gemini / OpenAI) for summarization
- **Deploy:** Docker multi-stage build

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

## Testing

```bash
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
npm run test:smoke    # Smoke tests against live staging
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
├── lib/           # Shared utilities (auth, mail, ai)
tests/
├── unit/          # Vitest unit tests
├── e2e/           # Playwright E2E tests
├── smoke/         # Post-deploy smoke tests
```

## Data Model

- **Users** — email auth, roles (user/admin)
- **Projects** — title, description, AI summary, deadline
- **Proposals** — per project, with pro/contra voting
- **Votes** — composite PK (proposal + user), +1/-1
- **Comments** — threaded (parentId), per proposal

## Contributing

See [AGENTS.md](AGENTS.md) for development guidelines, architecture rules, and commit conventions.

## License

Private — SurCod SRL
