# Ideate Deep Analysis Report

**Date:** 2026-02-17
**Prepared for:** Sprint 31 Planning
**Scope:** Full codebase audit — architecture, security, performance, testing, UX, accessibility, tech debt, DevOps

---

## Executive Summary

Ideate is a well-structured, feature-complete Next.js 16 application with SQLite (better-sqlite3 + Drizzle ORM), JWT auth, i18n (EN/RO), AI-powered suggestions (Gemini + OpenAI), and real-time voting (SSE). The codebase is in strong shape: **zero TypeScript errors**, **808 tests (all passing)**, **99% statement / 94% branch coverage**, and **zero TODO/FIXME markers**. The Docker setup is production-ready with multi-stage builds and health checks.

Key areas for improvement: 4 security findings (1 high, 3 medium), 13 accessibility gaps (3 critical WCAG violations), missing enterprise features (teams, audit export, SSO), and several code quality items (duplicated functions, missing Zod validation on AI endpoints).

---

## 1. Diagnostic Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | **Clean** — zero errors, zero warnings |
| `npm run build` | **Clean** — Next.js 16.1.6 (Turbopack), 12s build, 36 routes |
| `npm audit` | **4 moderate** — esbuild via drizzle-kit (dev dependency only) |
| `npm outdated` | 3 packages: eslint 9→10 (major), lucide-react patch, shadcn patch |
| `vitest --coverage` | **808 tests, 54 files, all passing** |
| Statement coverage | **99.07%** |
| Branch coverage | **93.85%** |
| Function coverage | **100%** |
| Line coverage | **99.50%** |
| TODO/FIXME/HACK | **Zero** — no markers found in source |
| Total source lines | **14,624** (src/**/*.ts + src/**/*.tsx) |
| Total test lines | **11,435** (tests/unit/**) |
| E2E tests | **16 files** (tests/e2e/) |

### Remaining Coverage Gaps

| File | Stmts | Branch | Uncovered Lines |
|------|-------|--------|-----------------|
| `middleware.ts` | 97.8% | 96.4% | 33 |
| `db/index.ts` | 94.6% | 83.3% | 77, 86-87 |
| `lib/export.ts` | 99.4% | 90.7% | 179, 337, 364, 407 |
| `lib/llm.ts` | 97.9% | 87.8% | 118, 221-225, 260 |
| `lib/mail.ts` | 98.2% | 86.7% | 8, 11, 15-16 |
| `lib/csrf.ts` | 95.8% | 87.5% | 32, 77 |
| `lib/password.ts` | 100% | 97.4% | 153 |
| `app/projects/actions.ts` | 100% | 95.8% | 63, 135 |

---

## 2. Architecture

### Folder Structure

```
src/
  app/              Next.js App Router (pages, layouts, server actions, API routes)
    admin/          Admin panel (user management, audit logs)
    api/            REST endpoints (auth, CRUD, SSE, AI, export, cron)
    auth/           Auth pages (login, register, forgot-password, reset, verify)
    dashboard/      Dashboard page + queries
    profile/        Profile page + actions
    projects/       Project CRUD + proposal/vote actions
  components/       React components
    ui/             shadcn/ui primitives (button, card, dialog, etc.)
    *.tsx           Feature components (header, proposal-list, comment-thread, etc.)
  db/               Drizzle ORM schema, queries, migration runner
  lib/              Service layer (auth, mail, LLM, export, RBAC, sanitize, i18n, etc.)
  middleware.ts     Route protection + security headers
```

### Data Flow

| Concern | Mechanism | Example |
|---------|-----------|---------|
| Page rendering | Server Components + DB queries | `projects/[id]/page.tsx` → `queries.ts` → `db` |
| Form mutations | Server Actions + revalidation | `proposals/actions.ts` → `db` → `revalidatePath` |
| Auth flows | REST API + JWT cookies | `api/auth/login-password/route.ts` → `setSessionCookie` |
| Real-time votes | SSE streaming | `api/votes/stream/route.ts` → `subscribeVotes` |
| AI features | REST API → LLM providers | `api/proposals/suggest/route.ts` → `completeWithFallback` |

**Assessment: Clean.** Server components call DB directly. Client components mutate via server actions. API routes serve stateless requests (auth, AI, export, SSE). No mixing of concerns.

### Issues Found

1. **`isDeadlinePassed` duplicated** in `app/projects/[id]/proposals/actions.ts:18` and `comment-actions.ts:16` — identical DB query, should be extracted to `lib/project-utils.ts`.

2. **`src/db/queries.ts` inconsistency** — contains only `getProjectComments`, while all other queries are page-local (`dashboard/queries.ts`, `projects/[id]/queries.ts`). Either commit to centralized queries or move the lone function.

3. **SSE is single-process only** — `vote-events.ts` uses an in-memory `Map<string, Set<VoteListener>>`. Votes on one process won't propagate to SSE subscribers on another. Acceptable for current SQLite single-instance deployment but blocks horizontal scaling.

---

## 3. Code Quality

### Strengths
- **Zero TODO/FIXME markers** — clean codebase
- **Consistent naming** — camelCase for variables/functions, PascalCase for components/types
- **Consistent patterns** — all server actions follow the same structure (auth check → validate → mutate → revalidate → return)
- **Good separation** — UI primitives in `components/ui/`, feature components at `components/`, service logic in `lib/`

### Issues

| Severity | Issue | Location |
|----------|-------|----------|
| Medium | **Duplicate `escapeHtml`** — defined in both `lib/export.ts:423` and `lib/sanitize.ts:19` | `lib/export.ts` should import from `sanitize.ts` |
| Medium | **Duplicate `isDeadlinePassed`** — identical function in two action files | Extract to shared utility |
| Medium | **Duplicate `Comment` type** — defined identically in `comment-thread.tsx:16` and `proposal-list.tsx:30` | Extract to `types/` |
| Medium | **Login page has 11 `useState` calls** (lines 33-41) | Extract to `useLoginForm` custom hook |
| Low | **`buildCommentTree` misnaming** — function sorts comments, doesn't build a tree (`comment-thread.tsx:27`) | Rename to `sortCommentsByTime` |
| Low | **Hardcoded `"en-US"` locale** in export date formatting (`export.ts:313,400,408`) | Should respect user locale |
| Low | **`generateReportHtml` potentially dead code** (`export.ts:324`) | Verify usage or remove |
| Low | **Hook placement** — `use-proposal-form.ts` in `components/` instead of `lib/` | Move to `lib/` |

---

## 4. Security

### Strengths
- JWT with HMAC-SHA256, secret length validation (>=32 chars), `jti` included, `issuer`/`audience` validation
- Automatic token rotation when < 3 days remain
- bcrypt with 12 rounds for password hashing
- SHA-256 hash stored for reset/verification tokens (raw token sent to user, hash in DB)
- CSRF double-submit cookie with `timingSafeEqual` — all 10 server actions protected
- CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- Parameterized queries via Drizzle ORM — no raw SQL injection vectors
- Rate limiting on all auth endpoints (IP + email double-gate)
- Test seed endpoint gated by `E2E_TEST_SECRET` env var — returns 404 when not set
- `dangerouslySetInnerHTML` used only for JSON-LD (static data, safe)
- Input sanitization via `sanitize.ts` (escapeHtml, stripHtml, sanitizeInput)

### Findings

| Severity | Issue | Details |
|----------|-------|---------|
| **HIGH** | **Open redirect in login** | `login/page.tsx:128`: `window.location.href = searchParams.get("redirect")` follows any value including `//evil.com`. Fix: validate `redirect.startsWith("/")`. |
| **MEDIUM** | **No JWT revocation** | `jti` field generated but no blocklist exists. Logout only deletes the cookie. A stolen token remains valid for up to 7 days. |
| **MEDIUM** | **Account takeover path** | `password.ts:98-108`: Adding a password to a magic-link-only account requires no ownership proof (no current-password check). An attacker who knows the email can set a password. |
| **MEDIUM** | **Missing HSTS header** | No `Strict-Transport-Security` configured anywhere. Production should have HSTS with `includeSubDomains`. |
| **MEDIUM** | **No Zod validation on AI endpoints** | `api/proposals/suggest` and `api/proposals/similarity` cast `request.json()` directly without schema validation. Oversized payloads (arrays with thousands of entries) passed directly to LLM. |
| **LOW** | **Middleware dot-check bypass** | `middleware.ts:79`: `pathname.includes(".")` makes any path with a dot public (e.g., `/admin/export.csv`). Should check specific file extensions. |
| **LOW** | **No rate limiting on non-auth routes** | Only auth endpoints are rate-limited. Proposals, votes, search, AI endpoints have no rate limiting. |
| **LOW** | **IP spoofing for rate limiting** | `request-utils.ts:9`: `x-forwarded-for` first entry used for rate limiting. Spoofable without a trusted proxy configuration. |
| **LOW** | **Silent auth error handling** | `auth.ts:90,177`: JWT verification errors caught but not logged, making debugging harder. |

---

## 5. Performance

### Build & Bundle
- **Build time**: 12s with Turbopack
- **Build output**: 345MB (`.next/`) — standard for standalone Next.js
- **Tree-shaking**: `optimizePackageImports: ["lucide-react"]` configured
- **Bundle analyzer**: Available via `ANALYZE=true npm run build`
- **Image optimization**: `next/image` used in header, AVIF + WebP formats configured

### Database
- **SQLite with WAL mode** — good for concurrent reads
- **`busy_timeout = 15000`** — handles write contention gracefully
- **`foreign_keys = ON`** — referential integrity enforced
- **Missing indexes**: No explicit indexes on `comments.projectId`, `comments.proposalId`, `proposals.projectId`. These are implicit via foreign keys in some DBs but not SQLite — queries will scan as data grows.
- **`comments.parentId` has no foreign key** — orphaned replies can exist after parent deletion

### SSE Implementation
- In-process pub/sub via `Map<string, Set<VoteListener>>` — lightweight and efficient for single-instance
- Proper cleanup on client disconnect
- No heartbeat/keepalive — long-lived connections may be silently dropped by proxies

### LLM Integration
- Gemini primary + OpenAI fallback with per-provider 15-min throttle on 429
- Per-hour rate limits on requests and tokens
- Cost tracking per provider
- Structured pino logging for every LLM call
- No response caching — identical prompts re-query the LLM

### Areas for Improvement
| Impact | Issue |
|--------|-------|
| Medium | Add DB indexes on `proposals.projectId`, `comments.projectId`, `comments.proposalId` |
| Low | Add SSE heartbeat (every 30s) to prevent proxy timeouts |
| Low | Consider LLM response caching for identical prompts (e.g., project summaries) |
| Low | `comments.parentId` should have a self-referencing FK or at least an index |

---

## 6. Test Coverage & Quality

### Overview
- **808 unit tests** across 54 files — all passing
- **16 E2E test files** (Playwright) covering auth, voting, comments, AI, CSRF, mobile, dashboard
- **Test-to-source ratio**: 11,435 test lines / 14,624 source lines = **0.78:1** (healthy)
- **Coverage**: 99% stmt / 94% branch / 100% func / 99.5% line

### Test Quality Assessment

**Strengths:**
- Tests verify real behavior, not implementation details — e.g., auth tests check token expiry, CSRF tests verify timing-safe comparison, LLM tests mock fetch and verify fallback logic
- DOM tests use RTL (React Testing Library) with proper user-event interactions
- E2E tests cover full flows: register → login → create → vote → comment → export
- Separate `*.dom.test.tsx` files for components requiring JSDOM environment
- DB migrations tested independently (`db-migrations.test.ts`)

**Gaps:**
- Coverage config only includes specific files — `page.tsx` and `route.ts` files are largely excluded from coverage reporting
- No visual regression testing
- No load/stress testing for SSE connections
- E2E tests require a running server — no fixture isolation

---

## 7. UX Gaps

### From `docs/ui-ux-review-chatgpt.md` — Status

| Original Issue | Status |
|----------------|--------|
| Proposal creation feedback | **RESOLVED** — toast notifications on success/error |
| Export functionality | **RESOLVED** — PDF/CSV export working |
| Form validation | **RESOLVED** — inline errors, `noValidate`, `aria-invalid` |
| Language consistency | **RESOLVED** — full i18n with EN + RO |
| Auth feedback | **RESOLVED** — error codes, resend-verification flow |
| Sorting/filtering/pagination | **RESOLVED** — search, sort, filter, pagination on projects + admin |
| Loading states | **RESOLVED** — loading text, disabled buttons, spinners |
| PWA banner overlaps content | **PARTIALLY RESOLVED** — dismissible but overlaps `fixed top-16` on mobile |
| Accessibility gaps | **PARTIALLY RESOLVED** — see Section 9 below |
| AI suggestions UX | **PARTIALLY RESOLVED** — dialog scrolls, has description, but no AI model disclosure |

### New UX Issues Found

| Severity | Issue | Location |
|----------|-------|----------|
| Medium | Profile page has no way to change email or password | `app/profile/page.tsx` |
| Medium | Comment threading data stored (`parentId`) but not rendered visually — flat list only | `components/comment-thread.tsx` |
| Low | Dashboard vote icons (ThumbsUp/Down) convey direction by color only — no text for screen readers | `app/dashboard/page.tsx` |
| Low | Search results have `role="option"` but no keyboard navigation (ArrowUp/Down) | `components/search-bar.tsx` |

---

## 8. Tech Debt

### Deprecated APIs
- **Next.js `middleware` convention deprecated** — build warns: "The `middleware` file convention is deprecated. Please use `proxy` instead." This will require migration to the new `proxy` convention in a future Next.js update.

### Dependencies
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| eslint | 9.39.2 | 10.0.0 | Major version — breaking changes expected |
| lucide-react | 0.564.0 | 0.566.0 | Patch update |
| shadcn | 3.8.4 | 3.8.5 | Patch update |

### `npm audit`
4 moderate vulnerabilities — all in `esbuild` via `drizzle-kit` (dev dependency only, not in production bundle). Fix requires breaking `drizzle-kit` downgrade — not recommended.

### Dead Code / Unused Exports
| Item | Location | Status |
|------|----------|--------|
| `buildProjectSummary()` | `lib/ai.ts` | Exported but never imported — verify or remove |
| `getAiUsageStats()` | `lib/llm.ts` | Exported but never imported — verify or remove |
| `getPermissions()`, `requirePermission()`, `canModifyResource()` | `lib/rbac.ts` | Exported but never imported |
| `sanitizeObject()` | `lib/sanitize.ts` | Exported but never imported |
| `generateReportHtml()` | `lib/export.ts` | Potentially unused — verify |

### Schema Issues
| Issue | Impact |
|-------|--------|
| `users.id` has no `$defaultFn(() => randomUUID())` unlike all other tables | Inconsistent — app code must always provide ID |
| `comments.parentId` has no foreign key constraint | Orphaned replies possible |
| No `updatedAt` on votes table | Upserted votes don't track modification time |

---

## 9. Accessibility (WCAG 2.1 Compliance)

### Strengths
- `<html lang={locale}>` dynamically set
- Vote buttons: `role="group"`, `aria-label`, `aria-pressed`
- Navigation: `aria-label` on desktop/mobile nav, `aria-current="page"` on active links
- Pagination: `aria-label` on nav and page links
- Form inputs: `aria-invalid`, `aria-describedby` on login/register forms
- 44px minimum touch targets on interactive elements

### Critical Issues (WCAG Level A)

| ID | Issue | WCAG SC | Location |
|----|-------|---------|----------|
| A.1 | **No skip-to-main-content link** | 2.4.1 Bypass Blocks | `components/app-shell.tsx` |
| A.2 | **`<main>` element has no `id`** for skip link target | 2.4.1 | `components/app-shell.tsx` |
| A.3 | **Search combobox has no keyboard navigation** — `role="listbox"` and `role="option"` declared but no ArrowUp/Down/Enter handlers | 2.1.1 Keyboard | `components/search-bar.tsx` |

### Medium Issues (WCAG Level A/AA)

| ID | Issue | WCAG SC | Location |
|----|-------|---------|----------|
| A.4 | **No `<h1>` on home page** — starts at `<h2>` | 1.3.1 | `app/page.tsx` |
| A.5 | **Login/register pages have no `<h1>`** — branding rendered as `<p>`, first heading is `<h3>` via CardTitle | 1.3.1 | `app/auth/login/page.tsx`, `register/page.tsx` |
| A.6 | **Filter/sort `<select>` elements have no labels** | 4.1.2 | `components/project-filters.tsx`, `app/admin/user-role-manager.tsx` |
| A.7 | **Icon-only buttons use `title` instead of `aria-label`** | 4.1.2 | `comment-thread.tsx:275`, `discussion-sheet.tsx`, `pwa-install.tsx` |
| A.8 | **Error messages missing `role="alert"`** | 4.1.3 | `app/auth/login/page.tsx:252,338` |
| A.9 | **`text-red-600` on white may fail AA contrast** for small text (~3.9:1) | 1.4.3 | Multiple form files |
| A.10 | **Admin inline role `<select>` has no per-row context** for screen readers | 4.1.2 | `app/admin/user-role-manager.tsx` |
| A.11 | **Proposal form errors not wired** — `aria-describedby` missing between input and error `<p>` | 1.3.1 | `components/proposal-form.tsx` |

### Low Issues

| ID | Issue | Location |
|----|-------|----------|
| A.12 | `aria-selected={false}` hardcoded on all search results — misleading | `search-bar.tsx:101` |
| A.13 | Dashboard vote icons lack sr-only text for direction | `app/dashboard/page.tsx` |
| A.14 | Nested AI suggestion dialogs may allow focus leakage | `components/suggest-proposals.tsx` |

---

## 10. Missing Enterprise Features

What an enterprise customer would expect that Ideate currently lacks:

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| **SSO (SAML/OIDC)** | High | High | Enterprise auth standard; currently only magic link + password |
| **Teams / Organizations** | High | High | No multi-tenancy; all users share one workspace |
| **Audit log export** | Medium | Low | Audit logs exist but can only be viewed in admin UI — no CSV/JSON export |
| **User invitation flow** | Medium | Medium | No way to invite users to the platform |
| **Configurable roles** | Medium | Medium | Roles are hardcoded (admin/manager/member/viewer) — no custom roles |
| **API rate limiting dashboard** | Medium | Low | Rate limits exist but no visibility for admins |
| **Webhook notifications** | Medium | Medium | No way to integrate with external systems |
| **Data retention policies** | Medium | Medium | No automated data cleanup or archival |
| **Change password in profile** | Medium | Low | Profile page has no password change flow |
| **Project archival with read-only mode** | Low | Low | Projects can be archived but still allow some mutations |
| **Bulk operations** | Low | Medium | No bulk delete, archive, or export |
| **Advanced analytics** | Low | High | No charts, trends, or usage dashboards |
| **File attachments on proposals** | Low | Medium | Text-only proposals |

---

## 11. DevOps

### Docker
- **Multi-stage build** (deps → build → production) — clean separation
- **Non-root user** (`nextjs:nodejs`, UID 1001)
- **Standalone output** — minimal production image
- **Health check** configured: `wget -qO- http://localhost:3000/api/health`
- **Two services**: staging (port 4100) and dev (port 4101) with named volumes

### CI Pipeline (`.github/workflows/ci.yml`)
- **4 jobs**: Lint → Typecheck → Unit Tests → Build (sequential, build depends on all three)
- Node 22, npm cache enabled
- Build provides env vars for DB and JWT

### Gaps

| Severity | Issue |
|----------|-------|
| Medium | **No E2E tests in CI** — only unit tests run; Playwright tests are manual |
| Medium | **No Docker image push** — CI builds but doesn't push to a registry |
| Medium | **No staging deployment automation** — `docker-compose up` is manual |
| Medium | **No monitoring/alerting** — no health check polling, no error tracking (Sentry, etc.) |
| Low | **No database backup automation in CI** — backup script exists but isn't scheduled |
| Low | **`middleware` → `proxy` migration needed** — Next.js 16 deprecation warning |
| Low | **Wiki sync workflow exists** but no other automation workflows |

---

## 12. Priority Recommendations for Sprint 31

### High Priority (Security + Accessibility)

| # | Item | Effort | Category |
|---|------|--------|----------|
| 1 | Fix open redirect in login (`redirect` param validation) | 15min | Security |
| 2 | Add Zod validation to AI API endpoints (suggest, similarity) | 1h | Security |
| 3 | Add skip-to-content link + `id="main-content"` on `<main>` | 30min | Accessibility |
| 4 | Fix heading hierarchy (h1 on home, login, register pages) | 30min | Accessibility |
| 5 | Replace `title` with `aria-label` on icon buttons (comment, discussion, PWA) | 30min | Accessibility |
| 6 | Add `aria-label` to unlabeled `<select>` elements | 30min | Accessibility |

### Medium Priority (Code Quality + Performance)

| # | Item | Effort | Category |
|---|------|--------|----------|
| 7 | Extract shared `isDeadlinePassed` to `lib/project-utils.ts` | 15min | Code Quality |
| 8 | Remove duplicate `escapeHtml` from `export.ts` | 15min | Code Quality |
| 9 | Add DB indexes on `proposals.projectId`, `comments.projectId`, `comments.proposalId` | 30min | Performance |
| 10 | Add `role="alert"` to dynamic error message containers | 30min | Accessibility |
| 11 | Add HSTS header in middleware | 15min | Security |
| 12 | Wire `aria-describedby` on proposal form errors | 15min | Accessibility |

### Low Priority (Tech Debt + DevOps)

| # | Item | Effort | Category |
|---|------|--------|----------|
| 13 | Remove unused exports (rbac, sanitize, ai, llm) | 30min | Tech Debt |
| 14 | Migrate `middleware.ts` to `proxy` convention | 1-2h | Tech Debt |
| 15 | Add E2E tests to CI pipeline | 1h | DevOps |
| 16 | Add error tracking (Sentry or similar) | 1-2h | DevOps |
| 17 | Implement search keyboard navigation or remove misleading ARIA roles | 1-2h | Accessibility |
| 18 | Add change-password flow to profile page | 2-3h | Feature |

---

## Appendix: Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/auth.ts` | 292 | JWT auth, session management, magic links |
| `src/lib/password.ts` | 299 | Password auth, registration, reset flow |
| `src/lib/llm.ts` | 270 | LLM abstraction (Gemini + OpenAI fallback) |
| `src/lib/export.ts` | 429 | PDF/CSV/HTML export generation |
| `src/app/auth/login/page.tsx` | 391 | Login page (magic link + password) |
| `src/components/suggest-proposals.tsx` | 303 | AI suggestion dialog |
| `src/components/comment-thread.tsx` | 298 | Messenger-style comment thread |
| `src/components/proposal-list.tsx` | 285 | Proposal cards with vote bars |
| `src/middleware.ts` | 161 | Route protection + security headers |
| `src/db/schema.ts` | 138 | Database schema (users, projects, proposals, votes, audit, comments) |
| `src/db/index.ts` | 112 | SQLite connection + auto-migration runner |

---

*Report generated 2026-02-17 for Sprint 31 planning.*
