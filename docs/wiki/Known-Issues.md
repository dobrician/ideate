# Known Issues

Track bugs, limitations, and technical debt here.

## Open

_None yet — Sprint 1 in progress_

## Potential Risks
1. **SQLite concurrent writes** — SQLite has a single-writer lock. For low-traffic internal tool this is fine, but may need WAL mode or migration to D1/Postgres at scale.
2. **Email deliverability** — smtp2go may need SPF/DKIM setup for surcod.ro to avoid spam filters.
3. **Docker volume persistence** — SQLite data in Docker volume must be backed up regularly.
4. **AI API costs** — Gemini/OpenAI calls for summarization need rate limiting.
5. **Session security** — JWT in cookie needs proper expiry, rotation, and CSRF protection.

## Resolved

_None yet_
