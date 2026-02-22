# Sprint 9 — Email/Password Authentication (2026-02-16)
**Status:** ✅ COMPLETE

## Goals
- [x] Add passwordHash and emailVerified columns + migration
- [x] Registration page (/auth/register)
- [x] Password hashing with bcrypt
- [x] Email verification flow
- [x] Dual-auth login (magic link + password)
- [x] Password recovery flow (forgot → reset)
- [x] Password requirements (min 8, uppercase, lowercase, number)
- [x] Rate limiting on all auth endpoints
- [x] New unit tests for all flows
- [x] Smoke test: full register → verify → login → forgot → reset
- [x] Keep magic link auth working (dual auth)
- [x] i18n: all new strings EN + RO

## Outcomes
- 21 commits, **541 tests** (+62 new), **32/32 smoke** (11.5s)
- Dual auth: password + magic link toggle on same login page
- Email verification with resend endpoint
- Password recovery: anti-enumeration on forgot-password
- Mail log system: eliminates SMTP timing from smoke tests (1.7min → 11.5s)
- DB migration: `0003_sprint9_password_auth.sql`
- 5 new API routes, 4 new pages

## Notes
- Key lesson: incremental commits improved visibility versus bulk end-of-sprint commits
