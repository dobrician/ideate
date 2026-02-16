# Sprint 21 — Migration Reliability & AI Feature Testing (2026-02-16)
**Status:** IN PROGRESS

## Goals

- [ ] Goal 1: Fix migration system — eliminate all race conditions and make migrations idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS in all .sql files), add integration test that simulates concurrent migration runs
- [ ] Goal 2: Fix Docker build — ensure `docker compose up -d --build` succeeds reliably every time, add CI step or smoke test that verifies Docker build
- [ ] Goal 3: Playwright E2E tests for AI Suggestions — test the full flow: login → create project → click "Sugestii AI" → dialog opens → suggestions load → vote on suggestions → submit → proposals created. Mock the LLM API at network level (Playwright route interception) so tests are deterministic
- [ ] Goal 4: Playwright E2E tests for Comments — test: add comment via send button, add comment via Enter key, comment appears in thread, empty comment rejected, messenger-style layout renders correctly
- [ ] Goal 5: Playwright E2E tests for Voting — test: vote pro, vote contra, change vote, vote bar renders with correct proportions, vote counts update in real-time
- [ ] Goal 6: Fix AI Suggestions reliability — investigate why suggestions work only once then fail. Check: Gemini rate limiting (429 → 15min throttle is too aggressive), LLM response truncation at various token limits, fallback chain Gemini→OpenAI must work seamlessly
- [ ] Goal 7: Add structured logging to LLM calls — log provider used, response time, token count, success/failure, so we can debug production issues without adding temporary console.logs
- [ ] Goal 8: Sprint 21 log + outcomes in Sprint-Log.md

## Constraints
- Commit + push after EACH goal
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
- All files < 300 lines
- Playwright tests must run against http://localhost:4100 (staging) with PLAYWRIGHT_BASE_URL
- Migration fix must be verified by running `docker compose up -d --build` twice in a row successfully
