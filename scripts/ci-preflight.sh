#!/usr/bin/env bash
# ci-preflight.sh — Quick checks to catch known CI failure patterns before push.
# Usage: bash scripts/ci-preflight.sh
# Can also be used as a pre-push hook: ln -s ../../scripts/ci-preflight.sh .git/hooks/pre-push
set -euo pipefail

ERRORS=0
WARNS=0

echo "=== CI Preflight Checks ==="

# 1. Seed route must set onboardingCompleted for test users
if ! grep -q 'onboardingCompleted.*true' src/app/api/test/seed/route.ts 2>/dev/null; then
  echo "FAIL: E2E seed route missing onboardingCompleted: true — tests will be blocked by onboarding modal"
  ERRORS=$((ERRORS + 1))
fi

# 2. Seed route should create unique users per invocation (test isolation)
if grep -q 'e2e-test@ideate.local' src/app/api/test/seed/route.ts 2>/dev/null; then
  echo "WARN: Seed route uses fixed email — parallel tests may collide"
  WARNS=$((WARNS + 1))
fi

# 3. E2E test assertions should match actual UI text (common mismatch patterns)
if grep -rn 'getByText(/ci alerts/i)' tests/e2e/ 2>/dev/null; then
  echo "WARN: E2E tests reference 'ci alerts' but UI says 'CI Build Alerts' — check category labels"
  WARNS=$((WARNS + 1))
fi

# 4. E2E comment tests should have adequate timeouts for CI (>= 15s)
LOW_TIMEOUTS=$(grep -rn 'toBeVisible.*timeout.*[0-9]' tests/e2e/comments.test.ts 2>/dev/null | grep -oP 'timeout:\s*\K[0-9]+' | awk '$1 < 15000' | wc -l || true)
if [ "$LOW_TIMEOUTS" -gt 0 ]; then
  echo "WARN: $LOW_TIMEOUTS comment test assertion(s) have < 15s timeout — may flake in CI"
  WARNS=$((WARNS + 1))
fi

# 5. DB migrations journal must exist and be valid JSON
JOURNAL="drizzle/meta/_journal.json"
if [ ! -f "$JOURNAL" ]; then
  echo "FAIL: Migration journal missing at $JOURNAL"
  ERRORS=$((ERRORS + 1))
elif ! python3 -c "import json; json.load(open('$JOURNAL'))" 2>/dev/null; then
  echo "FAIL: Migration journal is invalid JSON"
  ERRORS=$((ERRORS + 1))
fi

# 6. TypeScript compiles
echo "Running typecheck..."
if ! npx tsc --noEmit 2>/dev/null; then
  echo "FAIL: TypeScript errors detected"
  ERRORS=$((ERRORS + 1))
fi

# 7. Lint passes
echo "Running lint..."
if ! npm run lint 2>/dev/null; then
  echo "FAIL: Lint errors detected"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "PREFLIGHT FAILED: $ERRORS error(s), $WARNS warning(s). Fix before pushing."
  exit 1
elif [ "$WARNS" -gt 0 ]; then
  echo "PREFLIGHT PASSED with $WARNS warning(s)."
else
  echo "PREFLIGHT PASSED: All checks OK."
fi
