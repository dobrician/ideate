# Sprint 2 — Auth & Core Features (2026-02-15)
**Status:** ✅ COMPLETE

## Goals
- [x] Email magic link auth (send link, verify, create session)
- [x] JWT session management (HTTP-only cookies) — with CSRF protection + token rotation (#5)
- [x] Login/register pages
- [x] Projects CRUD (create, list, view, edit, delete)
- [x] Basic routing structure
- [x] README.md with setup instructions
- [x] Smoke test suite (`npm run test:smoke`)

## Outcomes
- 7 conventional commits, 20 tests total
- Email magic link: JWT 15m expiry, 7d sessions, auto-rotation, CSRF, enumeration prevention
- Projects CRUD: list/create/detail/edit/delete with zod validation, ownership checks
- Smoke suite: 8 tests covering homepage, health, login, static assets, auth, errors
- Issue #5 (JWT security) closed

## Notes
- All tests passing, zero regressions
