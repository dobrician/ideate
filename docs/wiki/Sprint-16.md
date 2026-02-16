# Sprint 16 — Project Comments & Quality (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Feature — Project Comments (#19):**
- [x] Project comments schema + migration: project_id column, nullable proposal_id, CHECK constraint (#19)
- [x] Project comments backend: getProjectComments, extend addComment, audit action, CSRF, unit tests (#19)
- [x] Project comments UI: shared comment-thread.tsx, ProjectComments component, Discussion section on project page (#19)

**Testing & Quality:**
- [x] Component tests for ProposalList and VoteButtons (bar chart width, vote sorting, empty state)
- [ ] E2E test for CSRF rejection (submit without token → verify rejection)

**Cleanup & Infrastructure:**
- [ ] Clean up dead code: unused i18n.ts, unused exports (buildProjectSummary, getAiUsageStats, etc.)
- [ ] SQLite backup automation: cron/systemd timer, daily with 7-day rotation, WAL checkpoint
- [ ] Update Known-Issues.md and Sprint-Log docs to reflect current state

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
