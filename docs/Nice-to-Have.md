# Nice to Have

Future improvements and feature ideas. Prioritize during sprint planning.

## Features
- [x] **Real-time voting updates** — SSE-powered live vote counts *(Sprint 4)*
- [x] **PDF/CSV export** — Export project reports with jsPDF *(Sprint 6, fixed Sprint 29)*
- [x] **Email notifications** — Notify on new proposals, votes, deadlines *(Sprint 6)*
- [x] **Role-based access** — Admin, manager, member, viewer with 13 permissions *(Sprint 4)*
- [x] **Audit logging** — Track all changes for compliance *(Sprint 5)*
- [x] **API rate limiting** — Auth endpoints + mutations + search *(Sprints 4, 18)*
- [ ] **Multi-tenant** — Organization-level isolation (requires PostgreSQL)
- [x] **Keyboard shortcuts** — Power user navigation *(Sprint 22)*
- [x] **Search** — FTS5 full-text search across proposals and comments *(Sprint 5)*
- [ ] **Tags/categories** — Organize proposals by topic
- [x] **Deadline reminders** — Email reminders before project deadline *(Sprint 6)*
- [ ] **Anonymous voting mode** — Optional hide voter identity
- [ ] **Delegation** — Delegate your vote to another user
- [x] **Mobile app** — PWA with install prompt and offline page *(Sprint 6)*
- [x] **Cloudflare deployment** — Pages + D1 + Workers, Resend mail, edge logger *(Sprint 00)*

## Technical
- [x] **GitHub Actions CI** — Automated testing on PR *(Sprint 5)*
- [x] **Structured logging** — Pino JSON logs for observability *(Sprint 15)*
- [x] **Error tracking** — Sentry integrated with source maps *(Sprint 00)*
- [ ] **Performance monitoring** — Core Web Vitals
- [x] **Database backups** — Automated SQLite snapshots with WAL checkpoint + 7-day rotation *(Sprint 16)*
- [ ] **MCP integrations** — Research useful Model Context Protocols
- [ ] **OpenTelemetry** — Distributed tracing

## UX
- [ ] **Onboarding flow** — First-time user guide
- [ ] **Proposal templates** — Pre-fill structure
- [x] **Rich markdown editor** — Markdown rendering for descriptions/proposals/comments *(Sprint 24)*
- [ ] **Drag-and-drop reorder** — Manual priority override for admins
- [ ] **Reaction emojis** — Quick feedback beyond +1/-1
