# Sprint 15 — Security Hardening, UX Fixes & Navigation Polish (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Security:**
- [x] Wire CSRF validation into all Server Actions (projects, proposals, admin, profile)
- [ ] Fail fast on migration errors at startup — process.exit(1) instead of swallowing (#19-spike)

**UX Bug Fixes:**
- [x] Fix registration form inline validation errors (#30)
- [x] Add admin link to navigation for admin users (#28)
- [ ] Improve magic link login UX — explanation text + "check your email" screen (#29)

**Navigation Polish:**
- [ ] Replace hand-rolled header dropdown with shadcn DropdownMenu (ARIA, keyboard nav)
- [ ] Add Header/AppShell component tests (desktop, mobile, admin, auth-gated)
- [ ] Clean up dead sidebar CSS variables and unused translation keys

**Infrastructure:**
- [ ] Add structured error logging with pino (JSON, timestamps, request IDs)
- [ ] Project-level comments/discussions spike — schema + UI design doc (#19)

**Hot Fix:**
- [ ] Proposal bar chart backgrounds must scale proportionally to votes, not full width (#31)

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
