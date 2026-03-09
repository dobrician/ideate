# Known Issues

Track bugs, limitations, and technical debt here.

## Open

1. **SQLite concurrent writes** — single-writer lock is fine for low-traffic internal use, but may need Postgres at scale (spike done in Sprint 13).
2. **Email deliverability** — SMTP provider may need SPF/DKIM setup for surcod.ro to avoid spam filters.
3. **Pre-existing lint warning** — `useEffect` missing dependency `t` in `projects/[id]/edit/page.tsx:61` (does not affect runtime).

## Security Vulnerabilities (npm audit — 2026-03-09)

5 high, 5 moderate — all require `npm audit fix --force` (breaking changes, need testing):

- **express-rate-limit** — IPv4-mapped IPv6 bypass: rate limiting can be circumvented on dual-stack servers ([GHSA-46wh-pxpv-q5gq](https://github.com/advisories/GHSA-46wh-pxpv-q5gq)) **HIGH**
- **hono** ≤4.12.3 — Cookie attribute injection, SSE CR/LF injection, arbitrary file access via serveStatic ([3 advisories](https://github.com/advisories/GHSA-5pq2-9x2x-5p6w)) **HIGH**
- **serialize-javascript** ≤7.0.2 — RCE via RegExp.flags/Date ([GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq)) **HIGH**
- Fix: run `npm audit fix --force` in a dedicated sprint, verify CI passes

## Potential Risks

1. **AI API costs** — rate-limited to 60 req/hr and 100K tokens/hr (configurable via env). Monitor usage.

## Resolved

1. **Docker volume persistence** — daily automated backup with 7-day rotation via systemd timer (Sprint 16).
2. **AI rate limiting** — per-hour request + token limits with per-provider 429 throttling (Sprint 4).
3. **Session security** — JWT with expiry, rotation, HttpOnly cookies, and CSRF double-submit tokens (Sprint 2, hardened Sprint 13-15).
4. **CSRF protection** — double-submit cookie pattern on all server actions, E2E tested (Sprint 15-16).
5. **HTML sanitization** — escapeHtml/stripHtml/sanitizeInput on all user input; CSP headers hardened (Sprint 13).
6. **Dead code** — unused exports cleaned up (Sprint 16).
