# CI Triage & Prevention Guide

## Quick Commands

```bash
# Run CI preflight before pushing
bash scripts/ci-preflight.sh

# Run unit tests locally (same as CI)
npm run test

# Run E2E tests locally (builds + serves + runs Playwright)
npx playwright test --project=chromium

# Run specific failing E2E test
npx playwright test tests/e2e/<file>.test.ts --project=chromium --grep "test name"
```

## Common CI Failure Patterns

### 1. Onboarding Modal Blocking E2E Tests

**Symptom:** E2E tests fail with `element(s) not found` — screenshot shows an onboarding dialog overlay.

**Root cause:** E2E seed API creates users without `onboardingCompleted: true`.

**Fix:** Ensure `src/app/api/test/seed/route.ts` sets `onboardingCompleted: true` on both insert and update paths.

**Prevention:** `scripts/ci-preflight.sh` checks for this pattern.

### 2. Cron Route Response Shape Mismatch

**Symptom:** `cron-jobs.test.ts` fails with `expected { ...N keys } to deeply equal { ...M keys }`.

**Root cause:** New fields added to the cron route response without updating the test.

**Fix:** Update the `toEqual()` assertion in `tests/unit/cron-jobs.test.ts` to include all fields returned by `POST /api/cron/jobs`.

**Prevention:** When adding new cron tasks that contribute to the response, also update the unit test.

### 3. E2E Selector / Text Mismatch

**Symptom:** `getByText(...)` or `getByRole(...)` times out with `element(s) not found`.

**Root cause:** Test assertions reference text that doesn't match the actual UI (e.g., `/ci alerts/i` vs "CI Build Alerts").

**Fix:** Check the actual rendered text via Playwright screenshot or `page.textContent()`, then update the assertion.

**Prevention:** Use partial regex patterns that tolerate reasonable UI copy changes.

### 4. Auth Session Token Rotation Test

**Symptom:** `auth-session.test.ts` fails on mock call count expectations.

**Root cause:** Auth logic changes (e.g., removing token rotation) without updating the corresponding test.

**Fix:** Align the test assertions with the actual auth behavior.

### 5. Strict Mode Violations in Playwright

**Symptom:** `strict mode violation: locator resolved to N elements`.

**Root cause:** `.or()` or broad locators matching multiple elements.

**Fix:** Use `.first()` or more specific locators. Prefer `getByRole` with name/level filters over `getByText` with broad regex.

### 6. RSC Streaming Timeouts in CI

**Symptom:** E2E test on admin page times out waiting for h1/heading, but passes locally.

**Root cause:** Production RSC streaming on CI runners is slower; default 10s expect timeout insufficient.

**Fix:** Use explicit `{ timeout: 15000-20000 }` on visibility assertions for server-rendered admin pages. Add `waitForURL` to confirm navigation completed.

**Prevention:** Always set `timeout >= 15000` for RSC-rendered page element assertions in E2E tests.

### 7. Test Isolation — Shared User State

**Symptom:** Admin E2E tests intermittently fail; one test's state mutation affects another.

**Root cause:** Seed API used fixed emails per role, so all admin tests shared one DB user.

**Fix:** Seed API creates unique users with UUID-based emails per invocation.

**Prevention:** Never share user identity across parallel E2E tests. Each `seedTestData()` call creates an isolated user.

### 8. Flaky Comment Enter Key Submission

**Symptom:** Comment tests flaky — `getByText("comment text")` not found after pressing Enter.

**Root cause:** Race between Playwright `fill()` → `press("Enter")` and React's onKeyDown handler attachment.

**Fix:** Add 100ms delay after `fill()` before pressing Enter; increase assertion timeout to 20s.

**Prevention:** For form submissions via keyboard, ensure React hydration is complete before key dispatch.

## CI Architecture

- **Jobs:** lint, typecheck, test (unit), build, smoke-tests, e2e-tests, docker-push
- **Dependencies:** build depends on [lint, typecheck, test]; smoke and e2e depend on build; docker-push depends on [smoke, e2e]
- **Artifact sharing:** Build output is tar'd and shared via upload-artifact/download-artifact
- **Playwright cache:** Browser binaries cached by `package-lock.json` hash
- **E2E isolation:** Each test creates a fresh user via seed API; parallel workers supported

## Debugging CI Failures

1. **Check which job failed:** `gh run view <run-id> --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'`
2. **Get failure logs:** `gh run view <run-id> --log-failed | tail -100`
3. **Download artifacts:** Failed E2E runs upload Playwright reports as artifacts
4. **Reproduce locally:** Run the exact failing test with `npx playwright test <file> --grep "test name"`
