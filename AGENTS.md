# AGENTS.md — Ideate Project

## What is this?
Enterprise democratic idea prioritization platform. Teams create projects, submit proposals, vote (pro/contra), discuss via threaded comments. Visual bar-chart shows consensus.

## Tech Stack
- Next.js 16 (App Router), TypeScript strict mode
- SQLite + Drizzle ORM (WAL mode enabled)
- Email magic link auth (JWT + nodemailer via configured SMTP provider)
- Tailwind CSS 4 + shadcn/ui
- Playwright E2E + Vitest unit tests
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
9. **100% test coverage** — every file has a corresponding test
10. **No `any` type** — TypeScript strict, no `@ts-ignore`
11. **JSDoc for public functions** — self-documenting code
12. **Structured error handling** — try/catch with meaningful errors everywhere

## Key Files
- `src/db/schema.ts` — Single source of truth for DB schema
- `src/db/index.ts` — DB connection singleton
- `src/lib/auth.ts` — Email magic link + JWT session (no WorkOS)
- `src/lib/mail.ts` — Nodemailer SMTP (configured SMTP provider)
- `src/lib/ai.ts` — Pluggable LLM (Gemini/OpenAI)
- `docker-compose.yml` — Staging (4100) + Dev (4101)
- `CHANGELOG.md` — Keep a Changelog format

## Data Model
- **users**: id, email, firstName, lastName, avatarUrl, role, createdAt
- **projects**: id, title, description (md), summary (AI), deadline, userId, createdAt
- **proposals**: id, projectId, userId, title, description (md), summary (AI), isNegativeInitiative, createdAt
- **votes**: proposalId + userId (composite PK), value (+1/-1)
- **comments**: id, proposalId, parentId (threading), userId, content (md), createdAt

## Auth Flow
1. User enters email → server generates JWT → sends magic link via SMTP
2. User clicks link → validates token → creates session cookie (HTTP-only, secure)
3. SMTP: configured SMTP provider (See .env.local), From: idea@surcod.ro
4. APP_URL: https://idea.surmont.co

## Testing — MANDATORY
- **Unit tests**: `tests/unit/` — Vitest, test every function and server action
- **E2E tests**: `tests/e2e/` — Playwright, test every user flow
- **Run before committing**: `npm run test && npm run test:e2e`
- **Coverage target**: 100% — no exceptions
- **Test naming**: `describe('ModuleName', () => { it('should do X when Y', ...) })`

## Docker
- Build: `docker compose build`
- Staging: always up on :4100 (idea.surmont.co)
- Dev: sprint work on :4101
- Promote: when all tests pass, rebuild staging from main

## Git Workflow
- Main branch: `main` (always deployable)
- Sprint branches: `sprint/YYYY-MM-DD-description`
- Squash merge to main after sprint completion
- Tag releases: `v0.X.0`

## Don't — CRITICAL RULES
- Don't use `any` type
- Don't skip error handling
- Don't write components over 300 lines
- Don't commit without running tests
- Don't use client-side data fetching when server components work
- Don't skip test coverage for any new code
- Don't use console.log in production code
- Don't hardcode configuration values
- **NEVER modify a test to make it pass when the code is the problem** — if a test fails, fix the code, not the test. Tests are the source of truth. The only valid reason to change a test is if the test itself has a genuine bug or if requirements changed (and that must be documented in the commit message).

## Reference
- Original ideator: `/home/dc/work/ideator` (read for feature reference, don't copy)
- Wiki docs: `docs/wiki/` in this repo
- GitHub issues: track risks and nice-to-haves
