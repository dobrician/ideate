# Sprint 6 — PWA, Export & Quality (2026-02-16)
**Status:** ✅ COMPLETE

## Goals
- [x] PDF/CSV export (#7)
- [x] PWA support (#12)
- [x] Comprehensive E2E tests
- [x] Security hardening (rate limiting, input sanitization, CSP)
- [x] Email notification system
- [x] Project deadlines with countdown + auto-close
- [x] Admin panel (user management, stats, audit viewer)
- [x] SEO (meta tags, OG, sitemap, JSON-LD)

## Outcomes
- 390 tests (up from 260), +29 new
- Export: PDF (HTML report) + CSV, per-project
- PWA: manifest, service worker, offline fallback, install prompt
- Security: rate limiting auth (5/email, 20/IP), sanitization, full CSP headers
- Notifications: email on vote/comment, 15-min debounce
- Deadlines: live countdown, auto-close voting, "Voting Closed" badge
- Admin: user roles, system stats, audit log
- Issues #7, #12 addressed
