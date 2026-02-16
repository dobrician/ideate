# Ideate v1.1.0 Deep Analysis Report

**Date:** 2026-02-16
**Prepared for:** Sprint 13 Planning
**Scope:** Full codebase audit (TypeScript, security, performance, architecture, production readiness)

---

## Executive Summary

Ideate is a well-structured Next.js idea prioritization platform at ~11,400 lines of TypeScript with solid fundamentals: zero type errors, 541 passing tests at 95.3% coverage, Zod validation on all API inputs, and RBAC enforcement throughout. However, the application has critical gaps blocking production readiness: SQLite cannot scale past a single server, the in-memory rate limiter resets on every deploy, CSRF "constant-time" comparison uses `===` instead of `timingSafeEqual`, and there is no team/organization model, meaning every user sees everything. The codebase is lean enough that Sprint 13 can address the most critical security and scalability issues while Sprint 14-16 can tackle the missing multi-tenancy, analytics, and onboarding features needed for a real product launch.

---

## Diagnostic Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | **Clean** -- zero errors, zero warnings |
| `npm audit` | **4 moderate** vulnerabilities (esbuild via drizzle-kit dev dependency) |
| `vitest --coverage` | **541 tests, 30 files, all passing** -- 95.3% statements, 85.7% branches, 96.7% functions |
| Tech debt markers | **Zero** `TODO`, `FIXME`, `HACK`, `XXX` in src/ |
| Largest file | `proposals/actions.ts` (341 lines) -- acceptable, but approaching split threshold |

### Coverage Gaps Worth Noting

| File | Stmts | Branch | Issue |
|------|-------|--------|-------|
| `status-utils.ts` | **0%** | **0%** | Completely untested |
| `email-deliverability.ts` | 82.5% | 58.8% | Error paths untested |
| `notifications.ts` | 92.2% | 78.4% | Debounce edge cases uncovered |
| `stat-card.tsx` | 92.3% | 71.4% | Conditional rendering branches |
| `export.ts` | 96.7% | 79.2% | Some format edge cases |

---

## Top 10 Highest-Impact Improvements

### 1. Replace SQLite with PostgreSQL (Critical -- Scalability)
SQLite is a single-file, single-writer database. It cannot handle concurrent writes from multiple server instances, makes horizontal scaling impossible, and has no connection pooling. This is the single biggest blocker to production deployment.

**Effort:** 2-3 days (Drizzle ORM abstracts most of it)

### 2. Move Rate Limiting to Redis/Persistent Store (Critical -- Security)
`src/lib/rate-limit.ts` uses an in-memory `Map`. Every server restart or new deployment resets all rate limits. In a multi-instance deployment, each instance has its own limits, making brute-force protection ineffective.

**Effort:** 0.5-1 day

### 3. Fix CSRF Timing-Safe Comparison (Critical -- Security)
`src/lib/csrf.ts:28` -- the comment says "Constant-time comparison to prevent timing attacks" but the implementation uses JavaScript `===`, which is not constant-time. Must use `crypto.timingSafeEqual()` with Buffer conversion.

**Effort:** 15 minutes

### 4. Add Multi-Tenancy / Team Model (High -- Architecture)
There is no concept of teams, organizations, or workspaces. Every authenticated user can see every project. The RBAC system has roles but no scoping: a "viewer" role applies globally, not per-project or per-team. This is a fundamental gap for any multi-user deployment.

**Effort:** 3-5 days

### 5. Tighten CSP -- Remove `unsafe-eval` (High -- Security)
`src/middleware.ts:65` -- the Content-Security-Policy includes `'unsafe-eval'` in `script-src`. This significantly weakens XSS protection. Next.js 16 with the App Router should work without `unsafe-eval`; at minimum, use `'nonce-based'` CSP.

**Effort:** 0.5-1 day

### 6. Add Input Sanitization to Notification Emails (High -- Security)
`src/lib/notifications.ts:95-96` -- proposal titles and user names are interpolated directly into HTML email templates without escaping. An attacker could craft a proposal title containing `<script>` or phishing HTML that gets emailed to other users (stored XSS via email).

**Effort:** 30 minutes (use the existing `escapeHtml` from `sanitize.ts`)

### 7. Eliminate Duplicated `getClientIp` Functions (Medium -- Maintenance)
The `getClientIp()` function is copy-pasted identically in 4 API route files (`register`, `login-password`, `forgot-password`, `resend-verification`). Extract to a shared utility.

**Effort:** 20 minutes

### 8. Add Database Indexes for Query Performance (Medium -- Performance)
The schema in `src/db/schema.ts` has no explicit indexes beyond primary keys and the votes composite PK. Queries filtering by `proposals.projectId`, `comments.proposalId`, `users.email`, and `auditLogs.userId` will table-scan as data grows.

**Effort:** 30 minutes

### 9. Deduplicate SMTP Transporter Creation (Medium -- Maintenance)
Both `src/lib/mail.ts` and `src/lib/notifications.ts` independently create their own nodemailer transporter singletons with identical SMTP configuration. This means two SMTP connections where one would suffice, and config changes need to be made in two places.

**Effort:** 30 minutes

### 10. Add Test Coverage for `status-utils.ts` (Low -- Quality)
The only file at 0% coverage. It's small (35 lines) but the gap is visible in reports and easy to fix.

**Effort:** 15 minutes

---

## Security Findings

### Critical

| Issue | Location | Description |
|-------|----------|-------------|
| **CSRF timing attack** | `csrf.ts:28` | Uses `===` instead of `crypto.timingSafeEqual()`. Comment explicitly claims constant-time but implementation is not. |
| **Rate limiter is ephemeral** | `rate-limit.ts` | In-memory store resets on deploy. No protection in multi-instance setups. Brute-force on login/register is possible after any restart. |

### High

| Issue | Location | Description |
|-------|----------|-------------|
| **HTML injection in emails** | `notifications.ts:95-96,153` | Proposal title and user firstName interpolated into HTML emails without escaping. Stored XSS vector. |
| **`unsafe-eval` in CSP** | `middleware.ts:65` | `script-src` allows `unsafe-eval`, undermining XSS protection. |
| **Middleware auth only checks cookie existence** | `middleware.ts:93-95` | Middleware checks `sessionCookie?.value` existence but does NOT verify the JWT. An invalid/expired/tampered JWT will pass the middleware and reach the page, where it fails later. This means unauthenticated users can reach protected page shells before being redirected client-side. |

### Medium

| Issue | Location | Description |
|-------|----------|-------------|
| **Gemini API key in URL** | `llm.ts:135` | `?key=${GEMINI_KEY}` in URL means the key appears in server logs and any HTTP proxy logs. Prefer header-based auth. |
| **No account lockout** | Auth routes | Rate limiting caps attempts per window but never locks an account after repeated failures. A determined attacker can wait out each 15-minute window indefinitely. |
| **`/api/search` is public** | `middleware.ts:20` | Listed in PUBLIC_PATHS but the handler requires auth. Inconsistent -- middleware lets the request through, then the handler rejects it. Not a vulnerability, but confusing and could mask future issues. |
| **No CORS configuration** | `middleware.ts` | No explicit CORS headers. Relies on `SameSite: strict` cookies, which is good, but API routes could still be probed. |

### Low

| Issue | Location | Description |
|-------|----------|-------------|
| **npm audit: 4 moderate vulns** | `drizzle-kit` chain | esbuild <= 0.24.2 allows development server request hijacking. Only affects `drizzle-kit` (dev dependency), not production. |
| **Vote value not validated** | `actions.ts:212` | `castVote` accepts `value: number` from the client with no validation that it's 1 or -1. A caller could pass 999. |

---

## Performance Findings

| Area | Status | Details |
|------|--------|---------|
| **Bundle size** | Unknown | No `next build` analysis run. `@next/bundle-analyzer` is installed but no baseline captured. |
| **DB queries** | N-query risk | `export/route.ts` makes 1 query per project + 1 for proposals + 1 for all comments. Acceptable for now, but no pagination on proposals/comments means large projects will be slow. |
| **No database indexes** | Risk | `proposals.projectId`, `comments.proposalId`, `auditLogs.userId` have no indexes. Will degrade as tables grow past ~10K rows. |
| **SSE keepalive** | 30s interval | `votes/stream/route.ts` sends keepalive every 30s. Reasonable, but no connection cap -- a malicious client could open hundreds of SSE connections. |
| **LLM calls** | Blocking | `buildProposalSummary` is called synchronously during proposal creation. If the LLM is slow (2-5s), the user waits. Should be async/queued. |
| **In-memory debounce** | OK for now | Notification debounce map in `notifications.ts` grows unbounded. Not a problem at small scale, but should be LRU-capped. |
| **Password hashing** | Intentionally slow | bcrypt tests take 6.2s (correct behavior), but login latency will be 200-500ms per attempt. Fine for auth, just noting it. |

---

## Missing Features for Production Readiness

### Must-Have (Blocks Launch)

1. **Multi-tenancy / Organizations** -- No team or workspace model. All users see all projects.
2. **PostgreSQL migration** -- SQLite cannot serve concurrent users in production.
3. **Persistent rate limiting** -- Redis or database-backed.
4. **Email preferences / unsubscribe** -- Notification emails have no opt-out. Likely violates CAN-SPAM/GDPR.
5. **Error monitoring** -- No Sentry, LogRocket, or equivalent. `console.error` statements are the only error reporting.
6. **Environment validation** -- No startup check that required env vars (JWT_SECRET, SMTP_*, DATABASE_URL) are properly set.

### Should-Have (Expected by Users)

7. **User onboarding flow** -- No welcome screen, tutorial, or guided first project creation.
8. **Analytics dashboard** -- `getAiUsageStats()` exists but is not exposed in any UI. No project-level analytics (participation rates, vote trends over time).
9. **User profile avatars** -- `avatarUrl` field exists in schema but is never populated or displayed.
10. **Activity feed / notifications UI** -- Email notifications exist but there's no in-app notification center.
11. **Project archival workflow** -- Status can be set to "archived" but there's no batch archive, no "completed" status, no closure summary.
12. **Pagination** -- No pagination on project lists, proposal lists, or comment threads. Will break with >50 items.
13. **File attachments on proposals** -- No way to attach documents, images, or links to proposals.
14. **Mobile responsive audit** -- Unknown if the UI works well on mobile. No viewport testing evidence.

### Nice-to-Have (Competitive Differentiation)

15. **SSO / OAuth** -- Only magic link + password auth. No Google, GitHub, or SAML SSO.
16. **Webhooks / integrations** -- No way to connect to Slack, Teams, or external tools.
17. **API rate limiting headers** -- API responses don't include `X-RateLimit-*` headers for client awareness.
18. **Proposal merging / linking** -- No way to mark duplicate proposals or merge similar ones.
19. **Bulk operations** -- No multi-select for proposals (bulk delete, bulk archive, bulk move).
20. **Audit log viewer** -- `auditLogs` table exists but there's no UI to browse it.

---

## Suggested Sprint 13 Goals

Sprint 13 should focus on **security hardening and scalability foundations** -- the unsexy work that unblocks everything else.

| # | Goal | Priority | Estimate |
|---|------|----------|----------|
| 1 | Fix CSRF timing-safe comparison (`crypto.timingSafeEqual`) | Critical | 0.5h |
| 2 | Sanitize HTML in notification email templates | Critical | 0.5h |
| 3 | Validate vote value is 1 or -1 in `castVote` | Critical | 0.5h |
| 4 | Remove `unsafe-eval` from CSP (test Next.js compat) | High | 2h |
| 5 | Add database indexes on foreign keys and frequent query columns | High | 1h |
| 6 | Extract shared `getClientIp` utility; deduplicate SMTP transporter | Medium | 1h |
| 7 | Add pagination to project list and proposal list (limit 20, cursor-based) | High | 4h |
| 8 | Move Gemini API key from URL param to request header | Medium | 1h |
| 9 | Add tests for `status-utils.ts` and improve `email-deliverability.ts` branch coverage | Medium | 1h |
| 10 | Spike: evaluate PostgreSQL migration path (Drizzle dialect swap, test locally) | High | 4h |

**Total estimated effort:** ~16 hours (fits a 1-week sprint for 1 developer)

---

## Roadmap: Sprints 14-16

### Sprint 14: Database Migration & Persistent Infrastructure
- Migrate from SQLite to PostgreSQL (Drizzle dialect swap + migration scripts)
- Implement Redis-backed rate limiting
- Add environment variable validation on startup (fail fast)
- Integrate error monitoring (Sentry or equivalent)
- Add `X-RateLimit-*` response headers to all rate-limited endpoints

### Sprint 15: Multi-Tenancy & User Experience
- Design and implement organization/team model (schema + RBAC scoping)
- Project visibility scoping (team-only, org-wide, public)
- User onboarding flow (welcome screen, first project wizard)
- In-app notification center (replace email-only notifications)
- Email preferences and unsubscribe links (GDPR compliance)

### Sprint 16: Analytics & Polish
- Project analytics dashboard (participation rates, vote trends, AI usage)
- Audit log viewer in admin panel
- User profile completion (avatar upload, display name)
- Proposal pagination and infinite scroll
- Mobile responsive pass (audit + fixes)
- SSO integration spike (Google OAuth as first provider)

---

## Appendix: File Size Distribution

| File | Lines | Note |
|------|-------|------|
| `translations/ro.ts` | 350 | Expected for i18n |
| `proposals/actions.ts` | 341 | Largest logic file -- approaching split threshold |
| `translations/en.ts` | 331 | Expected for i18n |
| `password.ts` | 286 | Complex but justified (registration, reset, hashing) |
| `auth/login/page.tsx` | 285 | Large form component |
| `auth.ts` | 283 | Core auth logic |
| `dashboard/page.tsx` | 258 | Could benefit from component extraction |
| `dropdown-menu.tsx` | 257 | Generated UI component (shadcn) |
| `discussion-sheet.tsx` | 253 | Complex UI -- reasonable |
| `proposal-list.tsx` | 247 | Complex UI -- reasonable |

No file exceeds 350 lines. The codebase is well-decomposed.

---

*Report generated by deep analysis of Ideate v1.1.0 codebase. All findings verified against source code.*
