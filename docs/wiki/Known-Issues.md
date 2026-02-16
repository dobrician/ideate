# Known Issues

Track bugs, limitations, and technical debt here.

## Open

1. **SQLite concurrent writes** — single-writer lock is fine for low-traffic internal use, but may need Postgres at scale (spike done in Sprint 13).
2. **Email deliverability** — SMTP provider may need SPF/DKIM setup for surcod.ro to avoid spam filters.
3. **Pre-existing lint warning** — `useEffect` missing dependency `t` in `projects/[id]/edit/page.tsx:61` (does not affect runtime).

## Potential Risks

1. **AI API costs** — rate-limited to 60 req/hr and 100K tokens/hr (configurable via env). Monitor usage.

## Resolved

1. **Docker volume persistence** — daily automated backup with 7-day rotation via systemd timer (Sprint 16).
2. **AI rate limiting** — per-hour request + token limits with per-provider 429 throttling (Sprint 4).
3. **Session security** — JWT with expiry, rotation, HttpOnly cookies, and CSRF double-submit tokens (Sprint 2, hardened Sprint 13-15).
4. **CSRF protection** — double-submit cookie pattern on all server actions, E2E tested (Sprint 15-16).
5. **HTML sanitization** — escapeHtml/stripHtml/sanitizeInput on all user input; CSP headers hardened (Sprint 13).
6. **Dead code** — unused exports cleaned up (Sprint 16).
