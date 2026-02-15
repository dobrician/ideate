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
- **Post-deploy smoke tests**: After deploying to staging, ALWAYS run `npm run test:smoke` against the live container. Deploy is NOT done until smoke tests pass.

## Smoke Tests — Post-Deploy Verification
Smoke tests live in `tests/smoke/` and run against the live staging URL (http://idea.surmont.co/).
They are NOT part of the unit/E2E suite — they test the real deployed container.

**What they verify:**
- HTTP 200 on `/` with real HTML content (not error page)
- `/api/health` returns 200 + valid JSON with status "ok"
- Static assets load (CSS, JS bundles)
- Auth flow accessible (login page renders)
- DB connection alive (health endpoint confirms)
- Environment variables loaded (no "missing config" errors)
- Docker container is healthy (`docker inspect` health status)

**Script**: `npm run test:smoke` — runs Playwright against `APP_URL` (defaults to http://idea.surmont.co/)
**When**: After every `docker compose up -d` on staging
**Failure = rollback**: If smoke tests fail, the deploy is failed — rollback or fix before reporting success

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

## Documentation — MANDATORY
- **README.md** must be maintained and kept up-to-date with every sprint
- **Sprint Log** (`docs/wiki/Sprint-Log.md`): update after EVERY completed task (check off the goal, add to Outcomes). Mark ✅ COMPLETE when sprint finishes, add next sprint section.
- **GitHub Wiki sync**: After updating any file in `docs/wiki/`, ALWAYS also push to the GitHub Wiki repo. Run: `cd /tmp && ([ -d ideate.wiki ] || git clone https://github.com/dobrician/ideate.wiki.git) && cp /home/dc/work/ideate/docs/wiki/*.md /tmp/ideate.wiki/ && cd /tmp/ideate.wiki && git add -A && git commit -m "docs: sync wiki" && git push`
- Include: project description, setup instructions, Docker usage, env vars, tech stack, architecture overview
- Update README.md whenever features, setup steps, or architecture changes

## Sprint Planning — Issues Management
At the START of every sprint:
1. Review ALL open GitHub issues (`gh issue list --state open`)
2. Identify which issues are relevant to this sprint's goals
3. Assign relevant issues to the sprint (add `sprint` label + comment with sprint name)
4. Risk issues (#1-5) take priority — address them as soon as the sprint touches related code
5. Create NEW issues for any problems discovered during development (bugs, tech debt, security)
6. Close issues with commit references when resolved (`fixes #N` in commit message)
7. Update issue status with comments as work progresses
8. At sprint END: review which issues were addressed, which remain, create new ones if needed

**Never forget issues exist.** They are the project's backlog and risk register.

## Sprint Completion Checklist
Before declaring a sprint done:
1. All tasks checked off in Sprint Log
2. All tests passing (unit + E2E + smoke)
3. Staging deployed and verified
4. Sprint Log updated with Outcomes
5. GitHub Wiki synced
6. README.md updated if needed
7. CHANGELOG.md updated
8. Git tagged if milestone

## Reference
- Original ideator: `/home/dc/work/ideator` (read for feature reference, don't copy)
- Wiki docs: `docs/wiki/` in this repo
- GitHub issues: track risks and nice-to-haves
