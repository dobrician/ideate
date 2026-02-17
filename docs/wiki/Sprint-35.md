# Sprint 35 — Production Hardening & DevOps

**Date:** 2026-02-17
**Focus:** Make Ideate production-ready: error tracking, E2E in CI, deployment automation, flaky test fix, SSE reliability

## Goals

- [x] **Goal 1: Add Sentry error tracking** — Install @sentry/nextjs. Configure for both client and server. Add error boundary integration. Create sentry.client.config.ts and sentry.server.config.ts. Use SENTRY_DSN env var (leave empty in dev to disable). Add source maps upload in build. Wrap API routes with Sentry error capture. Test that errors are captured correctly.

- [x] **Goal 2: E2E tests in CI pipeline** — Add a CI job that runs Playwright smoke tests against a built app. Use the existing playwright.smoke.config.ts. Start the app with `npm start` in CI, wait for ready, run tests. Add to .github/workflows/ci.yml as a new job after Build. Cache Playwright browsers.

- [x] **Goal 3: Fix flaky password-auth smoke test** — The "full register -> verify -> login flow via API" test fails intermittently. Investigate the verification URL timing issue. Add proper retry/wait logic. Ensure the test passes 10/10 runs locally.

- [x] **Goal 4: SSE heartbeat + reconnection** — Add 30-second heartbeat pings to the SSE vote stream to prevent proxy timeouts. Add exponential backoff reconnection on the client side if connection drops. Test with unit tests.

- [x] **Goal 5: Database backup automation** — Create a backup script (scripts/backup-db.sh) that copies the SQLite DB + WAL to a timestamped backup file. Add retention (keep last 7 daily backups). Make it runnable via npm script (`npm run db:backup`). Document in README.

- [x] **Goal 6: User invitation flow** — Add ability for admins to invite users by email. Create /api/admin/invite endpoint. Send invitation email with a link to register. Track pending invitations in a new `invitations` table. Show pending invitations in admin panel. Add tests.

- [x] **Goal 7: Audit log export** — Add CSV and JSON export buttons to the admin audit log section. Export all audit entries (with pagination/date range filter). Use the existing export patterns from project export. Add tests.

- [x] **Goal 8: Middleware → proxy migration** — Migrate from deprecated Next.js `middleware.ts` to the new `proxy` convention. This removes the build warning "The middleware file convention is deprecated." Keep all existing functionality (auth, security headers, CSRF, rate limiting). Test thoroughly.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
