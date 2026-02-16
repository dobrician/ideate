# Ideate Deep Analysis Report

**Date:** 2026-02-16
**Prepared for:** Sprint 15 Planning
**Scope:** Full codebase audit post-Sprint 14 (diagnostics, UI overhaul review, security, production readiness)

---

## Diagnostic Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | **Clean** -- zero errors, zero warnings |
| `npm audit` | **4 moderate** -- esbuild via drizzle-kit (dev dependency only, not production) |
| `vitest --coverage` | **562 tests, 32 files, all passing** |
| Statement coverage | **97.25%** (up from 95.3% in Sprint 13) |
| Branch coverage | **89.11%** (up from 85.7%) |
| Function coverage | **99.18%** (up from 96.7%) |
| Line coverage | **98.61%** |

### Coverage Gaps Remaining

| File | Stmts | Branch | Notes |
|------|-------|--------|-------|
| `stat-card.tsx` | 92.3% | 71.4% | Conditional rendering branches |
| `proposals/actions.ts` | 92.9% | 90.3% | A few error paths |
| `db/index.ts` | 91.7% | 50% | Migration bootstrap paths |
| `mail.ts` | 96.4% | 76.7% | SMTP config fallback paths |
| `notifications.ts` | 92.7% | 83.3% | Debounce edge cases |

---

## Open GitHub Issues

| # | Title | Label |
|---|-------|-------|
| 30 | Registration form lacks inline validation errors | bug |
| 29 | Magic link login needs explanation | enhancement |
| 28 | Add admin link to navigation for admin users | enhancement |
| 19 | Project-level comments/discussions | enhancement |
| 13 | Cloudflare deployment (Pages + D1) | nice-to-have |

5 issues remain. Issues 28-30 are small UX fixes from Sprint 14 triage. Issue 19 is a feature request. Issue 13 is a deployment option.

---

## UI Overhaul Review (Sidebar Removed, Top Nav)

The sidebar-to-top-nav migration from Sprint 14 is **functionally complete**. No broken tests. All 562 tests pass.

### Dead Code to Clean Up

| Item | Location |
|------|----------|
| 16 `--sidebar-*` CSS custom properties | `src/app/globals.css` (lines 26-33, 63-70, 98-105) |
| `nav.toggleSidebar` translation key | `src/lib/translations/en.ts` + `ro.ts` line 11 |
| `nav.navigation` translation key | `src/lib/translations/en.ts` + `ro.ts` line 10 |
| Stale comment "no sidebar" | `src/app/auth/logout/route.ts` line 6 |

### Navigation Concerns

| Concern | Severity | Details |
|---------|----------|---------|
| Hand-rolled dropdown menu | Medium | Header user dropdown lacks ARIA `role="menu"`, keyboard nav, focus trap. Shadcn `DropdownMenu` component already exists in the project. |
| Auth state fetched on every page load | Medium | Header calls `/api/me` on every mount. No caching. Potential flash of unauthenticated state on fast navigations. |
| No component tests for Header/AppShell | Medium | E2E covers basic link presence but no mobile nav, auth-gated visibility, or dropdown behavior tests. |

---

## Security Findings (Current State)

### Resolved Since Sprint 13
- CSRF now uses `timingSafeEqual` (fixed)
- Vote value validation added (fixed)
- HTML sanitization in notification emails (fixed)
- CSP `unsafe-eval` removed (fixed)
- Database indexes added on foreign keys (fixed)
- Gemini API key moved to header auth (fixed)

### Still Open

| Severity | Issue | Details |
|----------|-------|---------|
| **HIGH** | CSRF module is dead code | `requireCsrfToken` is never called in any Server Action. The module exists but is not wired in. `sameSite: strict` provides implicit protection only. |
| **HIGH** | In-memory rate limiter | Resets on restart, per-process only. Ineffective in multi-instance deployments. |
| **MEDIUM** | Middleware skips JWT verification | Only checks cookie presence, not signature. Auth is enforced at the Server Action layer, so it's safe but adds latency before rejection. |
| **MEDIUM** | No token revocation | Compromised JWTs are valid for up to 7 days with no way to invalidate. |
| **MEDIUM** | No structured logging | All errors go to `console.error`. No Sentry, no request IDs, no structured format. |
| **MEDIUM** | Migration failures silently swallowed | `src/db/index.ts` catches and ignores migration errors at startup. |
| **LOW** | No rate limiting on proposals/votes/search | Only auth endpoints are rate-limited. |
| **LOW** | No account lockout mechanism | Rate limits reset per window; no permanent lockout after repeated failures. |

---

## Production Readiness Gaps

| Area | Status | Gap |
|------|--------|-----|
| Auth/sessions | Good | No token revocation store |
| CSRF | Broken | Module exists but is never called |
| Rate limiting | Weak | In-memory, single-process only |
| Error boundaries | Good | Per-route error boundaries exist |
| Email | Good | Real SMTP, working templates |
| i18n | Good | EN + RO complete and in sync |
| Observability | Missing | No structured logging, no error tracking service |
| Backups | Missing | No SQLite backup strategy (no litestream, no cron) |
| File uploads | Missing | Avatar URL field exists but no upload endpoint |
| Multi-tenancy | Missing | All users see all projects globally |

---

## PostgreSQL Migration Assessment

The migration plan at `docs/postgres-migration-plan.md` is thorough and well-structured. Key facts:

- **21 files affected**, 5 phases, estimated 9-14 hours total
- Biggest risk: FTS5 to PostgreSQL `tsvector` rewrite for full-text search
- Test environment needs rethinking (no `:memory:` in PostgreSQL)
- Infrastructure changes: Docker Compose, backup scripts, CI services

**Recommendation: Do NOT migrate in Sprint 15.** The current SQLite setup works fine for the single-instance deployment at `idea.surmont.co`. The migration is a 2-3 day effort that blocks other work and is only necessary when scaling to multiple instances. Defer to Sprint 16+ or when multi-instance deployment is actually needed. Instead, focus Sprint 15 on security fixes and UX improvements that directly affect users.

---

## Sprint 15 Goals

Focus: **Security hardening, UX bug fixes, and navigation polish.** Realistic scope for 1 developer, 1 week.

### Goal 1: Wire CSRF validation into all Server Actions
**Priority: High | Effort: 2-3h**
The `requireCsrfToken` function exists and is correct but is never called. Add CSRF validation to every mutation in `projects/actions.ts`, `proposals/actions.ts`, `admin/actions.ts`, and `profile/actions.ts`. This closes the biggest security gap remaining.

### Goal 2: Fix registration form inline validation errors (Issue #30)
**Priority: High | Effort: 2-3h**
The registration form currently submits and shows errors only after server round-trip. Add client-side inline validation (required fields, email format, password strength) with error messages displayed next to each field.

### Goal 3: Add admin link to navigation for admin users (Issue #28)
**Priority: Medium | Effort: 1-2h**
The admin link is already in the header's mobile dropdown but is reportedly missing or inconsistent. Verify the admin link renders correctly in both desktop nav and mobile nav for users with the admin role. Add E2E test coverage.

### Goal 4: Improve magic link login UX (Issue #29)
**Priority: Medium | Effort: 1-2h**
Add clear explanation text on the magic link login page: what it is, how it works, and that users should check their email. Add a "check your email" confirmation screen after submission.

### Goal 5: Replace hand-rolled header dropdown with shadcn DropdownMenu
**Priority: Medium | Effort: 2-3h**
The current user profile dropdown in `header.tsx` is a custom `div` with no ARIA roles, no keyboard navigation, and no focus trap. Replace with the existing `src/components/ui/dropdown-menu.tsx` shadcn component for proper accessibility.

### Goal 6: Add Header/AppShell component tests
**Priority: Medium | Effort: 3-4h**
No component-level tests exist for the navigation. Add Vitest + React Testing Library tests covering: desktop nav links render, mobile nav renders, admin link visible only for admin users, sign out visible only when authenticated, dropdown opens/closes, auth-gated routes skip navigation.

### Goal 7: Clean up dead sidebar code
**Priority: Low | Effort: 30min**
Remove the 16 `--sidebar-*` CSS variables from `globals.css`, the unused `nav.toggleSidebar` and `nav.navigation` translation keys, and the stale "no sidebar" comment.

### Goal 8: Add structured error logging
**Priority: Medium | Effort: 2-3h**
Replace bare `console.error` calls with a lightweight structured logger (e.g., `pino`) that outputs JSON with timestamps, request IDs, and error context. This is the minimum observability needed before any production incident occurs. Wire it into Server Actions and API routes.

### Goal 9: Fail fast on migration errors at startup
**Priority: Medium | Effort: 30min**
`src/db/index.ts` silently swallows migration failures. Change the catch block to log the error and call `process.exit(1)` so a broken migration is immediately visible instead of running against an incomplete schema.

### Goal 10: Project-level comments/discussions spike (Issue #19)
**Priority: Low | Effort: 2-3h**
Spike only: design the schema additions (comments table already exists for proposals; extend to project-level), plan the UI placement, and document the approach. Do not implement in this sprint.

---

### Sprint 15 Summary

| # | Goal | Priority | Effort |
|---|------|----------|--------|
| 1 | Wire CSRF validation into Server Actions | High | 2-3h |
| 2 | Fix registration inline validation (Issue #30) | High | 2-3h |
| 3 | Admin nav link fix (Issue #28) | Medium | 1-2h |
| 4 | Magic link login UX (Issue #29) | Medium | 1-2h |
| 5 | Replace header dropdown with shadcn DropdownMenu | Medium | 2-3h |
| 6 | Header/AppShell component tests | Medium | 3-4h |
| 7 | Clean up dead sidebar code | Low | 0.5h |
| 8 | Structured error logging | Medium | 2-3h |
| 9 | Fail fast on migration errors | Medium | 0.5h |
| 10 | Project comments/discussions spike (Issue #19) | Low | 2-3h |

**Total estimated effort:** ~18-24 hours (fits a 1-week sprint)

**What's deliberately out of scope:**
- PostgreSQL migration (defer to Sprint 16+ -- not needed at current scale)
- Multi-tenancy/teams (requires PostgreSQL first)
- Redis-backed rate limiting (defer until multi-instance deployment is planned)
- Cloudflare deployment (Issue #13 -- nice-to-have, not blocking)
- File upload/avatar support (not user-requested)

---

*Report generated from automated analysis of Ideate codebase at commit 47f5692 on main branch.*
