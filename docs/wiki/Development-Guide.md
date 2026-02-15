# Development Guide

## For AI Agents (Claude Code, Codex)

### Before Starting Any Work
1. Read `AGENTS.md` in repo root — non-negotiable
2. Check `CHANGELOG.md` for recent changes
3. Run `git log --oneline -10` to understand current state
4. Check `docs/sprints/` for current sprint goals

### Code Standards
- **TypeScript strict** — no `any`, no `@ts-ignore`
- **Max 300 lines per file** — split into modules if larger
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- **All exports must be typed** — no implicit any returns
- **Error handling everywhere** — try/catch with meaningful errors
- **No console.log in production** — use structured logging

### File Creation Checklist
For every new file:
- [ ] Under 300 lines
- [ ] Has corresponding test file
- [ ] Exports are typed
- [ ] Has JSDoc for public functions
- [ ] Error handling for async operations
- [ ] Loading states for UI components

### Sprint Workflow
1. Create sprint branch: `sprint/YYYY-MM-DD-description`
2. Implement features with tests
3. Ensure 100% test coverage
4. Run full test suite
5. Update CHANGELOG.md
6. Squash merge to main
7. Update wiki Sprint Log
8. Tag release if significant

### Docker Development
```bash
# Build and run dev container
docker compose up dev --build

# Build and run staging
docker compose up staging --build

# Run tests against container
npm run test:e2e

# Promote dev to staging (after tests pass)
docker compose down staging
docker compose up staging --build
```

### Git Conventions
- Branch: `sprint/YYYY-MM-DD-short-description`
- Commits: conventional format, frequent, atomic
- Main: always deployable
- Tags: `v0.X.0` for sprint completions

## For Tibi (Orchestrator)

### Heartbeat Checks
Every 30 minutes:
1. Check Claude Code session status
2. If running: note progress, no intervention
3. If finished: analyze output, plan next sprint
4. If failed: diagnose, restart with fix

### Sprint Planning
After each sprint:
1. Review what was built
2. Check test coverage
3. Identify gaps and issues
4. Plan next sprint (1-3 focused features)
5. Update wiki Sprint Log
6. Create GitHub issues for known problems

### Escalation to Ciprian
Only when:
1. Need credentials or external access
2. Usage approaching 80%
3. Sprint completed with demo-ready features
4. Daily report

## Specialized Agents

### Claude Code — Primary Builder
- Writes application code
- Implements features
- Fixes bugs
- Refactors for quality

### Codex CLI — Test Writer & Researcher
- Writes Playwright E2E tests
- Writes Vitest unit tests
- Researches MCPs and tools
- Web research for best practices

### Tibi (OpenClaw) — Project Owner
- Sprint planning and prioritization
- Progress monitoring (heartbeats)
- Quality gate (reviews before merge)
- Communication with Ciprian
- Wiki and documentation maintenance
- GitHub issues management
