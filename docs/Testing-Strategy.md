# Testing Strategy

## Goal: 100% Test Coverage at All Times

Every feature must ship with tests. No exceptions.

## Test Pyramid

### Unit Tests (Vitest)
- **All utility functions** in `src/lib/`
- **All server actions** — mock DB, test business logic
- **All API routes** — test request/response
- **DB schema validation** — ensure constraints work
- Coverage target: 100% lines, branches, functions

### E2E Tests (Playwright)
- **Every user flow** — login, create project, submit proposal, vote, comment
- **Responsive testing** — mobile + desktop viewports
- **Dark mode** — visual consistency
- **Error states** — invalid input, network errors, auth failures
- **Accessibility** — axe-core integration

### Adversarial Testing Model
```
┌──────────────┐     writes tests     ┌──────────────┐
│   Codex CLI  │ ──────────────────→  │  Test Suite  │
└──────────────┘                      └──────┬───────┘
                                             │
                                      must pass
                                             │
┌──────────────┐     writes code      ┌──────▼───────┐
│ Claude Code  │ ──────────────────→  │  Codebase    │
└──────────────┘                      └──────────────┘
```

- **Codex** writes tests first (TDD style)
- **Claude Code** writes implementation to pass tests
- Neither agent sees the other's "strategy"
- This catches assumptions and blind spots

## Test Commands
```bash
# Unit tests
npm run test              # single run
npm run test:watch        # watch mode

# E2E tests (requires Docker running)
npm run test:e2e          # headless
npx playwright test --ui  # interactive

# Coverage report
npx vitest run --coverage
```

## CI/CD Integration (Future)
- GitHub Actions on PR
- Must pass all tests before merge
- Coverage report posted as PR comment
- Playwright screenshots on failure

## Test File Conventions
- Unit: `tests/unit/<module>.test.ts`
- E2E: `tests/e2e/<feature>.spec.ts`
- Fixtures: `tests/fixtures/`
- Test utils: `tests/helpers/`

## Known Testing Challenges
1. **SQLite in Docker** — tests run against Docker container, not local
2. **Email testing** — use mock SMTP or test accounts
3. **AI responses** — mock LLM calls, test prompt construction
4. **Real-time updates** — test WebSocket/SSE connections
