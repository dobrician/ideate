# Sprint 01 — Export Coverage, Sentry, E2E CI, Proxy Migration & Dead Code

**Date:** 2026-02-18
**Focus:** Add export.ts tests, close rate-limit/digest branch gaps, integrate Sentry, add E2E to CI, complete proxy migration, remove unused exports

## Goals

- [ ] **Goal 1: Cloudflare deployment completion** — resolve remaining D1 migration issues, test production deploy, close issue #13 (DevOps)
- [ ] **Goal 2: Add `lib/export.ts` to test coverage** — currently at 0% stmts/branch (excluded from coverage config). Add unit tests for PDF, CSV, and HTML export generation (Testing)
- [ ] **Goal 3: Close remaining branch gaps in `lib/rate-limit.ts`** — cover lines 26 and 101 (currently 80% branch) (Testing)
- [ ] **Goal 4: Close remaining branch gaps in `lib/digest.ts`** — cover lines 22-23 (currently 83.3% branch) (Testing)
- [ ] **Goal 5: Add error tracking (Sentry)** — integrate Sentry for production error monitoring, source maps, and alert routing (DevOps)
- [ ] **Goal 6: Add E2E tests to CI pipeline** — configure Playwright in GitHub Actions with a test server, run on PR and push to main (DevOps)
- [ ] **Goal 7: Migrate `middleware.ts` to `proxy.ts` convention** — address Next.js 16 deprecation warning for the middleware file convention (Tech Debt)
- [ ] **Goal 8: Remove unused exports** — audit and remove dead exports: `buildProjectSummary`, `getAiUsageStats`, `getPermissions`, `requirePermission`, `canModifyResource`, `sanitizeObject`, `generateReportHtml` (Tech Debt)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
