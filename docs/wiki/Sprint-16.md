# Sprint 16 — Project Comments & Quality (2026-02-16)
**Status:** ✅ COMPLETE

## Goals

**Feature — Project Comments (#19):**
- [x] Project comments schema + migration: project_id column, nullable proposal_id, CHECK constraint (#19)
- [x] Project comments backend: getProjectComments, extend addComment, audit action, CSRF, unit tests (#19)
- [x] Project comments UI: shared comment-thread.tsx, ProjectComments component, Discussion section on project page (#19)

**Testing & Quality:**
- [x] Component tests for ProposalList and VoteButtons (bar chart width, vote sorting, empty state)
- [x] E2E test for CSRF rejection (submit without token → verify rejection)

**Cleanup & Infrastructure:**
- [x] Clean up dead code: unused i18n.ts, unused exports (buildProjectSummary, getAiUsageStats, etc.)
- [x] SQLite backup automation: cron/systemd timer, daily with 7-day rotation, WAL checkpoint
- [x] Update Known-Issues.md and Sprint-Log docs to reflect current state

## Constraints
- Commit + push after EACH fix
- Lint + type check + tests + build must pass before each push

## Outcomes
- 8 commits, **595 tests** (+16 new), **32/32 smoke** (11.8s)
- Feature: Project-level comments with schema, backend, and UI (#19)
- Testing: ProposalList/VoteButtons component tests, CSRF E2E rejection test
- Cleanup: 6 dead exports removed
- Infrastructure: SQLite backup automation (systemd timer, 7-day rotation)
- Docs: Known-Issues.md updated

## Notes
- Auto-check hook had false positives (goals 2-3 checked prematurely by #19 in goal 1 commit) — Claude Code manually reverted
- Created issues #32-35 from UI feedback on comment drawer and vote bars
