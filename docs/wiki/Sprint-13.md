# Sprint 13 — Security Hardening & Scalability Foundations (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals (from deep analysis report)
- [x] Fix CSRF timing-safe comparison (crypto.timingSafeEqual)
- [x] Sanitize HTML in notification email templates
- [ ] Validate vote value is 1 or -1 in castVote
- [ ] Remove unsafe-eval from CSP
- [ ] Add database indexes on foreign keys
- [ ] Extract shared getClientIp + deduplicate SMTP transporter
- [ ] Pagination on project list and proposal list
- [ ] Move Gemini API key to request header
- [ ] Tests for status-utils.ts + email-deliverability coverage
- [ ] PostgreSQL migration spike (analysis doc)

## Constraints
- Commit + push after EACH fix
- Lint + type check + tests + build must pass before each push
