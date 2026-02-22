# Sprint 15 — Security Hardening, UX Fixes & Navigation Polish (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Security:**
- [x] Wire CSRF validation into all Server Actions (projects, proposals, admin, profile)
- [x] Fail fast on migration errors at startup — process.exit(1) instead of swallowing (#19-spike)

**UX Bug Fixes:**
- [x] Fix registration form inline validation errors (#30)
- [x] Add admin link to navigation for admin users (#28)
- [x] Improve magic link login UX — explanation text + "check your email" screen (#29)

**Navigation Polish:**
- [x] Replace hand-rolled header dropdown with shadcn DropdownMenu (ARIA, keyboard nav)
- [x] Add Header/AppShell component tests (desktop, mobile, admin, auth-gated)
- [x] Clean up dead sidebar CSS variables and unused translation keys

**Infrastructure:**
- [x] Add structured error logging with pino (JSON, timestamps, request IDs)
- [x] Project-level comments/discussions spike — schema + UI design doc (#19)

**Hot Fix:**
- [x] Proposal bar chart backgrounds must scale proportionally to votes, not full width (#31)

## Constraints
- Commit + push after EACH fix
- Lint + type check + tests + build must pass before each push

## Outcomes
- 12 commits across 3 sessions, **579 tests** (+17 new), **32/32 smoke** (12.1s)
- Security: CSRF validation wired into all Server Actions
- UX: Registration inline validation, magic link explanation, admin nav link
- Navigation: Radix DropdownMenu with ARIA roles, keyboard nav, focus trap
- Infrastructure: pino structured logging, fail-fast migrations
- Cleanup: dead sidebar CSS/translations removed
- Design: project comments spike doc (`docs/project-comments-spike.md`)
- Bug fix: proposal bar chart scales proportionally (#31)

## Notes
- Hit max turns twice (120 + 80) — needed 3 sessions for 11 goals
- CI broke on header tests (Radix ARIA roles) — fixed in follow-up commit
- Git hook auto-checkoff working well with issue numbers
