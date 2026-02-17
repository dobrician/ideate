# Sprint 37 — Search, Webhooks & Developer Experience

**Date:** 2026-02-17
**Source:** Deep analysis report remaining items + developer experience improvements
**Focus:** Full-text search, webhook notifications, API docs, comment threading, LLM caching

## Goals

- [x] **Goal 1: Full-text search across all entities** — Add a unified search page/modal that searches across projects, proposals, and comments. Use SQLite FTS5 (already available). Show results grouped by type with highlighted matches. Add keyboard shortcut (Cmd/Ctrl+K) to open search. Add tests.

- [x] **Goal 2: Webhook notifications** — Allow admins to configure webhook URLs that receive POST notifications on key events: new project, new proposal, vote cast, project archived. Add `webhooks` table (id, url, events, secret, active, createdAt). Admin UI to manage webhooks. Sign payloads with HMAC-SHA256. Retry failed deliveries (3 attempts with exponential backoff). Add tests.

- [x] **Goal 3: Comment threading UI** — Comments already store `parentId` but display as flat list. Render threaded/nested comments with visual indentation (max 3 levels deep). Add "Reply" button on each comment. Collapse deep threads with "Show more replies". Add tests.

- [x] **Goal 4: LLM response caching** — Cache AI suggestion responses to avoid re-querying for identical prompts. Add `llm_cache` table (hash of prompt → response, ttl, createdAt). TTL: 24 hours. Check cache before calling LLM. Add cache hit/miss logging. Add tests.

- [x] **Goal 5: Interactive API documentation** — Generate OpenAPI/Swagger spec from existing API routes. Serve interactive docs at /api/docs using swagger-ui or similar. Document all endpoints with request/response schemas. Auth endpoints, CRUD, AI, export, admin, webhooks.

- [ ] **Goal 6: Email digest / weekly summary** — Add a weekly digest email option in notification preferences. Aggregate: new projects, top voted proposals, recent activity stats. Generate HTML email with summary. Add a cron-compatible endpoint that can be called to send digests. Add tests.

- [ ] **Goal 7: Project templates** — Allow admins to create project templates with pre-filled title prefix, description, default tags, and deadline offset (e.g., "+30 days"). Users can create a project from a template. Add `project_templates` table. Admin UI to manage templates. Add tests.

- [ ] **Goal 8: Data export improvements** — Add full platform data export for admins (all projects + proposals + votes + comments as ZIP). Add per-user data export (GDPR compliance — user can download all their data). Add date range filter to existing project exports. Add tests.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
