# Deep Analysis — Sprint 42 Planning

**Date:** 2026-02-18
**Branch:** `main` @ `e3b08fb`
**Analyzer:** Automated codebase audit (lint, types, tests, coverage, security, a11y, i18n, code quality)

---

## Executive Summary

Ideate is in strong shape: lint and typecheck pass cleanly, 98.6% test coverage, 1383/1384 tests green, and a well-optimized 2.1 MB static bundle. The architecture is mature with consistent CSRF protection, comprehensive rate limiting, and proper RBAC across all surfaces.

**Key findings requiring action:**

| Priority | Count | Summary |
|----------|-------|---------|
| Critical | 2 | XSS in search results, 1 failing test |
| Medium | 6 | Duplicate boilerplate, i18n gaps, analytics perf, missing error logging |
| Low | 6 | Dead code cleanup, a11y polish, docs stale |

---

## 1. Critical Issues (Must Fix)

### 1.1 XSS Vulnerability in Search Results

**File:** `src/components/search-bar.tsx:197`
```tsx
<div dangerouslySetInnerHTML={{ __html: result.snippet }} />
```

FTS5 `snippet()` wraps matches in `<mark>` tags, but user-authored content (project titles, proposal text) is not sanitized. An attacker can inject `<img src=x onerror=alert(document.cookie)>` in a proposal title, and it executes when another user searches.

**Fix:** Sanitize with allowlist — only permit `<mark>` tags:
```tsx
import { escapeHtml } from "@/lib/sanitize";
// Or use DOMPurify: DOMPurify.sanitize(snippet, { ALLOWED_TAGS: ['mark'] })
```

The codebase already has `escapeHtml` in `src/lib/sanitize.ts` — it needs to be applied before the `<mark>` tags are inserted, or a post-hoc sanitizer needs to strip everything except `<mark>`.

**CVSS:** 8.1 (High) — session hijacking, credential theft

### 1.2 Failing Test: mail.test.ts

**File:** `tests/unit/mail.test.ts:201`

The test expects `"SMTP configuration required"` but gets `"Failed to send email"`. Root cause: `SMTP_HOST` is captured at module load time (line 8 of `mail.ts`), so resetting `process.env.SMTP_HOST` and re-importing doesn't change the already-captured value. The `sendEmail()` function catches the validation error and re-throws with the generic message.

**Fix:** Either (a) make `validateSmtpConfig` read env vars at call time instead of using module-level constants, or (b) update the test expectation to match the actual error path.

---

## 2. Medium Issues (Should Fix)

### 2.1 Massive Server Action / API Route Boilerplate Duplication

**Impact:** ~650 lines of repeated code across 45+ files

Every server action (8 files) and API route (37 files) repeats the same 6-12 line auth + CSRF + rate-limit + permission check boilerplate:

```typescript
await requireCsrfToken(csrfToken);
const user = await requireAuth();
const ip = await getActionClientIp();
const rl = checkRateLimit(`key:${ip}`, max, window);
if (!rl.allowed) return { error: "Too many requests..." };
if (!hasPermission(user.role as Role, "permission")) return { error: "..." };
```

**Stats found:**
- `return { error:` appears 144 times across action files
- `requireOrigin` appears in 20 API route files
- `checkRateLimit` appears 54 times across 23 files
- `getCurrentUser` appears 39 times across 17 files

**Fix:** Create `withActionAuth()` and `withApiAuth()` wrapper functions (details in section 8).

### 2.2 i18n: 214+ Hardcoded Error Messages Not Translatable

**UI components:** 100% internationalized (all use `t()` function)
**Server actions + API routes:** 0% internationalized (all error strings hardcoded in English)

| Category | Count |
|----------|-------|
| "Too many requests..." | 38 |
| "Failed to..." | 67 |
| "You must be logged in" | 15 |
| "You don't have permission..." | 10+ |
| Other validation messages | 84+ |

**Translation file gaps:**
- 4 keys missing in RO (plural forms: `dashboard.projectComments_one`, etc.)
- 19 keys untranslated in RO (still English: Dashboard, Admin, Email, etc.)
- 1 extra key in RO not in EN (`admin.selected_one`)

**Fix:** Add error translation keys and refactor actions to use them. Can be done incrementally.

### 2.3 Analytics Queries: N+1 Performance Issue

**File:** `src/app/admin/analytics/queries.ts:62-65`

```sql
SELECT (SELECT COUNT(*) FROM proposals WHERE project_id = projects.id),
       (SELECT COUNT(*) FROM votes WHERE proposal_id IN (SELECT id FROM proposals WHERE project_id = projects.id)),
       (SELECT COUNT(*) FROM comments WHERE project_id = projects.id)
FROM projects LIMIT 10
```

Three correlated subqueries per row = 30 extra queries for 10 projects. Plus two UNION ALL full table scans for activity/engagement.

**Fix:** Rewrite with JOINs and GROUP BY.

### 2.4 Missing Error Logging in Critical Paths

- **Webhook failures silently swallowed:** `fireWebhookEvent(...).catch(() => {})` in `projects/actions.ts` (3 locations)
- **AI suggestion route:** catch block doesn't log the error
- **rbac.ts:67:** `JSON.parse(row.permissions)` can throw on malformed data — no try/catch

**Fix:** Add `logger.warn` to webhook catches, `logger.error` to AI catch, wrap JSON.parse in rbac.ts.

### 2.5 Cron Endpoint Uses Non-Timing-Safe Comparison

**File:** `src/app/api/cron/project-summaries/route.ts:23-26`

```typescript
if (auth !== `Bearer ${CRON_SECRET}`) { ... }
```

Uses `!==` instead of `timingSafeEqual`. The CSRF module already uses timing-safe comparison — cron auth should too.

### 2.6 role-manager.tsx Uses `window.location.reload()`

**File:** `src/app/admin/role-manager.tsx:49`

After creating a custom role, does a full page reload instead of optimistic state update. Loses any unsaved state in other admin sections.

**Fix:** Update local state optimistically.

---

## 3. Low Issues (Nice to Fix)

### 3.1 Known Issues Doc Is Stale

`docs/Known-Issues.md` item 2 says "No JWT revocation store" but migration `0017_sprint40_revoked_tokens.sql` exists — this was implemented. Should be moved to Resolved.

### 3.2 Accessibility Polish

| Issue | Location | Severity |
|-------|----------|----------|
| Permission badges not keyboard-accessible | `role-manager.tsx:96-99` | Low |
| No ARIA live regions for dynamic updates | `role-manager.tsx` | Low |
| Chart color-only differentiation (pro/contra) | `charts.tsx:66-67` | Low |
| Focus management in dialog open/close | `proposal-form.tsx` | Low |
| Inconsistent touch target sizes | Various auth pages | Low |

### 3.3 Chart Components Missing Memoization

**File:** `src/app/admin/analytics/charts.tsx`

Five chart components (`ProposalTrendChart`, `ActivityChart`, `VoteDistributionChart`, etc.) re-render on every parent render. Should wrap with `React.memo()`.

### 3.4 Missing Database Transactions in Role Actions

**File:** `src/app/admin/role-actions.ts`

`createCustomRole` does existence check + insert + audit log as separate queries. Should use `db.transaction()` for atomicity.

### 3.5 Dead Code: search-d1.ts Only Self-References

`src/lib/search-d1.ts` (167 lines) exports `searchD1` — only imported within the same file. This is the Cloudflare D1 search adapter; it may be loaded dynamically. Verify it's actually wired into the D1 deployment path.

### 3.6 `clearDiscoveryCache` in oidc.ts Unused Outside Tests

`clearDiscoveryCache()` is only called from test files — not a problem, but could be annotated.

---

## 4. Health Metrics Summary

| Metric | Value | Status |
|--------|-------|--------|
| ESLint | 0 errors, 0 warnings | Pass |
| TypeScript | 0 errors | Pass |
| Tests | 1383/1384 pass (1 fail in mail.test.ts) | Warn |
| Coverage (statements) | 98.59% | Excellent |
| Coverage (branches) | 98.98% | Excellent |
| Coverage (functions) | 98.29% | Excellent |
| Coverage (lines) | 98.64% | Excellent |
| Static bundle size | 2.1 MB | Good |
| Server bundle size | 77 MB (includes node_modules for standalone) | Normal |
| Largest JS chunk | 373 KB (recharts) | Acceptable |
| Total routes | 57 (49 static + 8 dynamic) | — |
| Total src/lib modules | 37 files, 5361 lines | — |
| Total components | 19 files, 3215 lines | — |
| Total action files | 8 files, 854 lines | — |
| Migrations | 20 applied | — |
| Translation keys | EN: 650, RO: 647 | 3 missing |

---

## 5. Security Posture

| Area | Rating | Notes |
|------|--------|-------|
| CSRF Protection | Excellent | Triple-layer: SameSite cookies + Origin check + double-submit token |
| Rate Limiting | Excellent | All mutation and auth endpoints covered |
| Authentication | Excellent | JWT with SHA-256 hashing, proper session verification |
| Admin Authorization | Excellent | Permission checks on all admin pages and actions |
| XSS Prevention | Needs Fix | Search bar `dangerouslySetInnerHTML` without sanitization |
| SQL Injection | Excellent | Drizzle ORM parameterized queries throughout, no raw SQL |
| Input Validation | Excellent | Zod schemas on all user inputs |
| Sensitive Data | Excellent | Passwords excluded from API responses, webhook secrets masked |
| OIDC | Good | Standard OAuth2 code flow with state parameter |
| Cron Auth | Needs Fix | Non-timing-safe comparison |

---

## 6. Architecture Quality

**Strengths:**
- Clean separation: lib (business logic), app (routes/pages), components (UI), db (schema)
- Consistent patterns across all server actions and API routes
- Comprehensive audit logging on all mutations
- i18n coverage on all UI surfaces
- PWA support with offline page

**Technical Debt:**
- Boilerplate duplication in actions/routes is the #1 maintainability issue
- Error messages not translatable (server-side hardcoded English)
- In-memory rate limiter (known, documented — fine for single-instance)
- SQLite single-writer (known, documented — PostgreSQL migration plan exists)

---

## 7. Recommended Sprint 42 Goals (8 Goals, Prioritized)

### Goal 1: Fix Search XSS Vulnerability (Critical, Security)
Sanitize `dangerouslySetInnerHTML` in `search-bar.tsx` using DOMPurify or the existing `escapeHtml` utility. Only allow `<mark>` tags from FTS5 snippets. Add test to verify script tags are stripped.
**Effort:** Small (1-2 hours). **Impact:** Closes critical security hole.

### Goal 2: Create Action/API Wrapper Functions (Medium, DX)
Build `withActionAuth()` for server actions and `withApiAuth()` for API routes. Centralize CSRF validation, auth, rate limiting, permission checks, error handling, and audit logging. Migrate 2-3 files as proof of concept.
**Effort:** Medium (4-6 hours). **Impact:** Eliminates ~650 lines of boilerplate, prevents auth/rate-limit omissions.

### Goal 3: Fix Analytics N+1 Queries (Medium, Performance)
Rewrite `analytics/queries.ts` to use JOINs instead of correlated subqueries. Add error handling. Extract magic numbers to constants. Memoize chart components.
**Effort:** Small-Medium (2-4 hours). **Impact:** Faster admin dashboard loads.

### Goal 4: Internationalize Error Messages (Medium, UX)
Add error translation keys to EN/RO files. Add the 4 missing RO plural forms. Translate the 19 untranslated RO keys. Start migrating server action error messages to use translation keys (can be incremental).
**Effort:** Medium (4-6 hours). **Impact:** Romanian users see translated error messages.

### Goal 5: Fix Failing Test + Harden mail.ts (Small, Quality)
Fix the `mail.test.ts` SMTP config test. Make `validateSmtpConfig` read env vars at call time. Add error logging to webhook `.catch()` handlers and AI suggestion route.
**Effort:** Small (1-2 hours). **Impact:** Green CI, better debugging.

### Goal 6: Add Onboarding Flow (Medium, UX)
Per Nice-to-Have: "First-time user guide". Create a simple step-through for new users (create project, add proposals, vote). Track completion in user profile. This is the highest-value unchecked UX item.
**Effort:** Medium (4-6 hours). **Impact:** Reduces time-to-value for new users.

### Goal 7: Tags/Categories for Proposals (Medium, Feature)
Per Nice-to-Have: "Organize proposals by topic". The `tags` table and migration already exist (`0010_tags.sql`). Wire up the UI: tag selector on proposal form, filter by tag on project page.
**Effort:** Medium (4-6 hours). **Impact:** Better organization for projects with many proposals.

### Goal 8: Accessibility Polish Pass (Small, A11y)
Make permission badges keyboard-accessible in role manager. Add ARIA live regions for dynamic updates. Ensure chart color-only differentiation works for color-blind users. Verify dialog focus management.
**Effort:** Small (2-3 hours). **Impact:** Better experience for keyboard/screen-reader users.

---

*Note: Error tracking (Sentry) was completed in Sprint 00 and is no longer a gap. Performance monitoring (Core Web Vitals) and OpenTelemetry remain open from the Nice-to-Have list but are lower priority than the goals above.*

---

## 8. Appendix: Proposed withActionAuth API

```typescript
// src/lib/action-wrapper.ts
export async function withActionAuth<T>(
  csrfToken: string,
  options: {
    permission?: Permission;
    rateLimitKey: string;
    rateLimitMax?: number;
    rateLimitWindow?: number;
  },
  handler: (user: AuthUser) => Promise<T>
): Promise<T | { error: string }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();
    const ip = await getActionClientIp();
    const rl = checkRateLimit(
      `${options.rateLimitKey}:${ip}`,
      options.rateLimitMax ?? 20,
      options.rateLimitWindow ?? 15 * 60_000
    );
    if (!rl.allowed) return { error: "Too many requests — please try again later" };
    if (options.permission && !hasPermission(user.role as Role, options.permission)) {
      return { error: "You don't have permission to perform this action" };
    }
    return await handler(user);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    logger.error({ err: error }, "Action error");
    return { error: "An unexpected error occurred" };
  }
}
```

**Usage:**
```typescript
export async function createProject(formData: FormData) {
  return withActionAuth(formData.get("csrfToken") as string, {
    permission: "project:create",
    rateLimitKey: "project:create",
    rateLimitMax: 10,
  }, async (user) => {
    // Pure business logic — no boilerplate
    const data = projectSchema.parse({ ... });
    await db.insert(projects).values({ ... });
    await logAudit({ ... });
    redirect(`/projects/${id}`);
  });
}
```
