# AGENTS.md — Ideate Project

## What is this?
Enterprise democratic idea prioritization platform. Teams create projects, submit proposals, vote (pro/contra), discuss via threaded comments. Visual bar-chart shows consensus.

## Tech Stack
- Next.js 15+ (App Router), TypeScript strict
- SQLite + Drizzle ORM
- WorkOS auth (SSO/Google/Magic Link)
- Tailwind CSS 4 + shadcn/ui
- Playwright E2E + Vitest unit
- Docker multi-stage build

## Architecture Rules
1. **Max 300 lines per file** — split if larger
2. **Server Components by default** — Client Components only when needed (interactivity)
3. **Server Actions for mutations** — no API routes unless needed for external calls
4. **Drizzle for all DB** — no raw SQL except migrations
5. **Conventional Commits** — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
6. **Error boundaries** — every page has one
7. **Loading states** — every async component has a skeleton
8. **Mobile-first** — responsive from the start

## Key Files
- `src/db/schema.ts` — Single source of truth for DB
- `src/lib/auth.ts` — Email magic link + JWT session (no WorkOS)
- `src/lib/ai.ts` — Pluggable LLM (Gemini/OpenAI)
- `docker-compose.yml` — Staging (4100) + Dev (4101)

## Testing
- E2E: `npx playwright test` (runs against Docker container)
- Unit: `npx vitest run`
- All tests must pass before merging to main

## Docker
- Build: `docker compose build`
- Staging: always up on :4100
- Dev: sprint work on :4101
- Promote: when all tests pass, dev → staging

## Git
- Main branch: `main`
- Sprint branches: `sprint/YYYY-MM-DD-description`
- Squash merge to main after sprint completion

## Don't
- Don't use `any` type
- Don't skip error handling
- Don't write components over 300 lines
- Don't commit without running tests
- Don't use client-side data fetching when server components work
