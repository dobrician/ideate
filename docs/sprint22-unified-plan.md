# Sprint 22 — Unified Auth Action Plan

**Date:** 2026-02-16
**Sources:** Claude analysis + Codex analysis
**Methodology:** All issues from both analyzers deduplicated, prioritized, and grouped by phase.

---

## Phase 1: Security Fixes (Critical)

| # | Task | Desired Outcome | Source |
|---|------|-----------------|--------|
| 1.1 | Enforce CSRF on all auth mutation routes | Every state-changing auth endpoint (register, login, forgot-password, reset-password, logout) validates a CSRF token before processing. Alternatively, document and test that `sameSite` cookie policy is the explicit CSRF defense. | Both |
| 1.2 | Validate JWT in middleware, not just cookie presence | Expired, malformed, or tampered session cookies cause a redirect to login instead of application errors deeper in the stack. | Both |
| 1.3 | Fix JWT_SECRET / APP_URL captured at module load | `JWT_SECRET` and `APP_URL` are read fresh from `process.env` on each use, not cached at import time. Hot-reloads and env changes take effect without restart. | Both |
| 1.4 | Implement account lockout after failed login attempts | After N consecutive failed logins, the account is temporarily locked with exponential backoff. Prevents brute-force attacks beyond the current 480-attempts/day window. | Both |
| 1.5 | Add audit logging to all auth events | Login (success/failure), registration, email verification, password reset, logout, and magic link requests all produce audit log entries with IP, user ID, and timestamp. | Both |
| 1.6 | Implement session/token revocation | The `jti` claim is checked against a revocation store (Redis or DB). Compromised tokens can be invalidated before expiry. Logout actually revokes the session. | Both |
| 1.7 | Hash reset tokens before storing in DB | Password reset and email verification tokens are stored as hashes (SHA-256), not raw values. A database leak doesn't expose valid tokens. | Codex |
| 1.8 | Invalidate all sessions after password reset | When a user resets their password, all existing sessions for that user are revoked. An attacker who stole a session loses access once the password is changed. | Codex |
| 1.9 | Fix reset-password raw Zod error exposure | The reset-password endpoint returns user-friendly error messages instead of raw Zod validation errors like "expected string, received undefined". | Codex |
| 1.10 | Add rate limiting to reset-password endpoint | The reset-password route has rate limiting comparable to other auth routes, preventing token brute-force attempts. | Claude |
| 1.11 | Tighten dot-based public path bypass in middleware | The `pathname.includes(".")` check is replaced with an explicit static file extension allowlist so paths like `/api/v2.0/secret` aren't accidentally public. | Both |
| 1.12 | Fix logout to reject GET requests | `GET /auth/logout` returns 405. Only POST is accepted, preventing logout-via-link CSRF attacks. | Codex |
| 1.13 | Review and restrict public paths | `/api/test/seed` and `/api/cron/project-summaries` are not publicly accessible in production (gated by env check or auth). | Claude |
| 1.14 | Fix email enumeration vectors | Registration returns a uniform "check your email" response (no 409). Per-email rate limit messages don't confirm the email exists. | Claude |
| 1.15 | Change session cookie sameSite to "lax" | Magic link flow works correctly — clicking a link from email sends the session cookie on the initial navigation. CSRF protection is maintained for POST requests. | Claude |
| 1.16 | Remove CSP `unsafe-inline` | CSP uses nonce-based script/style loading instead of `unsafe-inline`, preventing inline injection attacks. | Both |
| 1.17 | Add password max length check (72 bytes) | Passwords over 72 bytes are rejected with a clear error, preventing silent bcrypt truncation and bcrypt DoS via huge payloads. | Claude |

---

## Phase 2: UX Improvements

| # | Task | Desired Outcome | Source |
|---|------|-----------------|--------|
| 2.1 | Create missing verify/page.tsx and verify-email/page.tsx | Email verification and magic link verification pages exist and render correctly, showing progress/success/error states. | Codex |
| 2.2 | Surface resend-verification on EMAIL_NOT_VERIFIED | When login fails because email isn't verified, the user sees a "Resend verification email" button instead of just an error message. | Both |
| 2.3 | Add password visibility toggle | All password fields (login, register, reset-password) have a show/hide toggle. | Both |
| 2.4 | Map error URL params to friendly messages | Login page translates error codes (`invalid_token`, `verification_failed`) into human-readable, translated messages instead of showing raw codes. | Claude |
| 2.5 | Add password strength indicator to reset-password | Reset-password page has the same client-side password validation and strength feedback as the registration page. | Claude |
| 2.6 | Fix autoFocus behavior on mobile | Password/email inputs don't auto-focus on mobile viewports, preventing the keyboard from immediately covering the UI. | Claude |
| 2.7 | Fix Link/Button nesting on forgot-password success | "Back to Login" button has correct click area and full-width styling. | Claude |
| 2.8 | Remove deprecated X-XSS-Protection header | The `X-XSS-Protection` header is removed since it's deprecated and can cause issues in some browsers. | Claude |

---

## Phase 3: Test Coverage

| # | Task | Desired Outcome | Source |
|---|------|-----------------|--------|
| 3.1 | Fix stale E2E auth tests | E2E tests match the current UI (password-first login, not magic-link-first). All existing tests pass against the actual app. | Both |
| 3.2 | Add middleware auth redirect tests | Unit tests verify: valid JWT → pass, expired JWT → redirect to login, missing cookie → redirect, malformed cookie → redirect. | Claude |
| 3.3 | Add logout route tests | Tests confirm POST logout clears session and redirects, GET logout returns 405. | Claude |
| 3.4 | Add resend-verification route tests | Tests cover requesting a new verification email, rate limiting, and error cases. | Claude |
| 3.5 | Add mobile viewport E2E tests | E2E tests run auth flows at mobile breakpoints, verifying layout, tap targets, and keyboard behavior. | Codex |
| 3.6 | Add audit logging integration tests | Tests verify that auth events produce correct audit log entries. | Claude |
| 3.7 | Add session rotation tests | Tests verify token rotation triggers correctly when session is near expiry and produces a valid new token. | Claude |
| 3.8 | Add account lockout tests | Tests verify lockout triggers after N failures and resets after the backoff period. | Claude |
| 3.9 | Add rate limiting integration tests | Tests verify rate limit behavior on magic link, login, and reset-password endpoints. | Claude |

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| **Phase 1: Security** | 17 | CSRF enforcement, JWT validation, session revocation, lockout, audit logging, token hashing |
| **Phase 2: UX** | 8 | Missing pages, error messages, password UX, mobile fixes |
| **Phase 3: Tests** | 9 | Stale test fixes, middleware tests, mobile viewport, integration coverage |
| **Total** | **34** | |
