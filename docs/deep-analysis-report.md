# Ideate Deep Analysis Report

**Date:** 2026-02-16
**Prepared for:** Sprint 16 Planning
**Scope:** Full codebase audit post-Sprint 15 (diagnostics, security review, tech debt, production readiness)

---

## Diagnostic Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | **Clean** — zero errors, zero warnings |
| `npm audit` | **4 moderate** — esbuild via drizzle-kit (dev dependency only, not in production bundle) |
| `vitest --coverage` | **579 tests, 33 files, all passing** |
| Statement coverage | **96.53%** |
| Branch coverage | **88.44%** |
| Function coverage | **98.38%** |
| Line coverage | **97.95%** |

### Coverage Gaps

| File | Stmts | Branch | Notes |
|------|-------|--------|-------|
| `csrf-client.ts` | 0% | 0% | Client-side cookie reader — no JSDOM cookie support in tests |
| `stat-card.tsx` | 92.3% | 71.4% | Conditional rendering branches |
| `proposals/actions.ts` | 93.2% | 90.3% | Some error paths uncovered |
| `db/index.ts` | 84.6% | 50% | Migration bootstrap paths |
| `mail.ts` | 96.4% | 76.7% | SMTP config fallback paths |
| `notifications.ts` | 92.7% | 83.3% | Debounce edge cases |

---

## Open GitHub Issues

| # | Title | Label |
|---|-------|-------|
| 19 | Project-level comments/discussions | enhancement |
| 13 | Cloudflare deployment (Pages + D1) | nice-to-have |

2 issues remain. Issue 19 has a completed design spike. Issue 13 is a deployment option (not blocking).

---

## Sprint 13-15 Review: Regressions & Tech Debt

### What Went Well
- **32 commits** across 3 sprints, 16 issues closed (#16-31)
- Test count grew from 562 to 579; 32/32 smoke tests passed throughout
- CSRF fully wired into all 10 server actions (was dead code before Sprint 15)
- Structured logging with pino replaced bare `console.error`
- Migration errors now fail-fast with `process.exit(1)`
- Sidebar removal completed cleanly: dead CSS/translations removed

### One Regression (Introduced & Fixed)
- Proposal bar chart scaling bug introduced in Sprint 14, fixed in Sprint 15 (`b05b359`). Bar width was calculated as upvotes/total instead of upvotes/max. Root cause: no component tests for `proposal-list.tsx`.

### Tech Debt Carried Forward
1. **Component test gap** — Only `Header`/`AppShell` have component tests. `ProposalList`, `VoteButtons`, `DiscussionSheet`, `ProposalForm` have none.
2. **In-memory rate limiter** — Resets on restart, per-process only. Ineffective for multi-instance.
3. **Middleware skips JWT verification** — Checks cookie presence, not signature. Auth is enforced at the server action layer, so functionally safe but wasteful (requests reach server actions before rejection).
4. **No token revocation** — Compromised JWTs valid for up to 7 days.
5. **No backup strategy** — SQLite `data/ideate.db` has no automated backup (no litestream, no cron).

---

## Security Assessment

### CSRF: Working End-to-End
The previous report flagged CSRF as dead code. Sprint 15 fixed this. Current state:

- Token generated on session creation (`setSessionCookie` in `auth.ts`)
- Double-submit cookie pattern: `httpOnly: false`, `sameSite: strict`
- Constant-time comparison via `timingSafeEqual`
- All 10 mutation server actions call `requireCsrfToken()`
- All client forms/buttons pass the token via hidden field or function argument
- Auth endpoints correctly skip CSRF (pre-authentication)
- 10 dedicated CSRF unit tests passing

**Verdict: No action needed.** CSRF is production-ready.

### Remaining Security Items

| Severity | Issue | Status |
|----------|-------|--------|
| Medium | In-memory rate limiter | Acceptable for single-instance; needs Redis for multi-instance |
| Medium | No JWT revocation store | Acceptable risk at current user count |
| Medium | Middleware doesn't verify JWT signature | Defense-in-depth gap; server actions do verify |
| Low | No rate limiting on proposals/votes/search | Only auth endpoints rate-limited |
| Low | No account lockout after repeated failures | Rate limits reset per window |

**No critical or high security issues remain.**

---

## Dead Code & Unused Dependencies

### Dead Code Found

| Item | Location | Action |
|------|----------|--------|
| `src/lib/i18n.ts` (entire file) | 50 lines | Delete — replaced by `i18n-server.ts` + `use-locale.ts` |
| `buildProjectSummary()` | `src/lib/ai.ts` | Exported but never imported anywhere |
| `getAiUsageStats()` | `src/lib/llm.ts` | Exported but never called |
| `getPermissions()` | `src/lib/rbac.ts` | Exported but never imported |
| `requirePermission()` | `src/lib/rbac.ts` | Exported but never imported |
| `canModifyResource()` | `src/lib/rbac.ts` | Exported but never imported |
| `sanitizeObject()` | `src/lib/sanitize.ts` | Exported but never imported |

### Dependencies
- **npm audit:** 4 moderate vulnerabilities, all in `esbuild` via `drizzle-kit` (dev-only, not in production bundle). Fix requires breaking `drizzle-kit` downgrade — not recommended.
- **No unused runtime dependencies detected.** All 17 production deps are imported.

### Bundle
- `.next` output: ~100MB (reasonable for Next.js standalone)
- `optimizePackageImports: ["lucide-react"]` configured for tree-shaking
- Bundle analyzer available via `ANALYZE=true`
- No bloat concerns.

---

## Production Readiness Gaps

| Area | Status | Notes |
|------|--------|-------|
| Auth/sessions | Good | JWT + magic link + password auth working |
| CSRF | Good | Fully wired, double-submit with timing-safe comparison |
| Rate limiting | Acceptable | In-memory, single-process; fine for current deployment |
| Error boundaries | Good | Per-route error boundaries |
| Email | Good | SMTP with templates, deliverability checks |
| i18n | Good | EN + RO complete |
| Observability | Improved | Pino structured logging added in Sprint 15 |
| Backups | Missing | No automated SQLite backup |
| Search | Good | FTS5 working, pagination |
| Project comments | Missing | Design spike done, implementation needed (Issue #19) |

---

## Spike Documents: What Should Sprint 16 Tackle?

### `docs/project-comments-spike.md` (Issue #19)
Design is complete. Schema change: add `project_id` column to `comments` table, make `proposal_id` nullable, add CHECK constraint. Estimated 5-8 hours. UI placement defined (Discussion section below proposals). Shared comment-thread component extraction needed.

**Recommendation: Implement in Sprint 16.** The spike answers all design questions. This is the only open feature request.

### `docs/postgres-migration-plan.md`
Thorough 5-phase plan, 21 files affected, estimated 9-14 hours. Biggest risk: FTS5-to-tsvector search rewrite.

**Recommendation: Defer again.** SQLite works fine for current single-instance deployment. Only migrate when multi-instance or managed DB is needed. Not Sprint 16 scope.

---

## Sprint 16 Goals

Focus: **Implement project comments (Issue #19), clean up dead code, shore up component tests, add SQLite backup.** Realistic scope for 1 developer.

### Goal 1: Implement project-level comments — schema + migration (Issue #19)
**Priority: High | Effort: 1-2h**
Add `project_id` column to `comments` table, make `proposal_id` nullable, add CHECK constraint ensuring exactly one is non-null. Add index on `project_id`. Follow the schema design in `docs/project-comments-spike.md`.

### Goal 2: Implement project-level comments — backend (Issue #19)
**Priority: High | Effort: 2-3h**
Add `getProjectComments()` query. Extend `addComment` server action to accept either `proposalId` or `projectId`. Add `"project_comment"` audit action type. Add CSRF validation (already pattern-established). Write unit tests for the new paths.

### Goal 3: Implement project-level comments — UI (Issue #19)
**Priority: High | Effort: 2-3h**
Extract shared `comment-thread.tsx` from `DiscussionSheet`. Create `ProjectComments` component. Add "Discussion" section to project detail page below proposals. Wire up the comment form with CSRF token.

### Goal 4: Add component tests for ProposalList and VoteButtons
**Priority: High | Effort: 2-3h**
The bar chart regression in Sprint 14 happened because `proposal-list.tsx` had zero test coverage. Add React Testing Library tests covering: bar chart width calculation, vote sorting, empty state, vote button interactions, and active vote highlighting.

### Goal 5: Clean up dead code
**Priority: Medium | Effort: 1h**
Delete `src/lib/i18n.ts` (entirely unused). Remove unused exports: `buildProjectSummary`, `getAiUsageStats`, `getPermissions`, `requirePermission`, `canModifyResource`, `sanitizeObject`. Update any tests that import these.

### Goal 6: Add SQLite backup script to cron
**Priority: Medium | Effort: 1-2h**
The `scripts/backup.sh` exists but is never scheduled. Add a cron entry or systemd timer to run daily backups with rotation (keep 7 days). Verify the backup script handles WAL checkpointing before copy. Document in `docs/Deployment.md`.

### Goal 7: Add E2E test for CSRF rejection
**Priority: Medium | Effort: 1h**
Current CSRF tests are unit-level with mocks. Add one smoke/E2E test that submits a server action without a valid CSRF token and verifies rejection. This ensures the end-to-end flow stays wired correctly.

### Goal 8: Update Known-Issues and Sprint-Log docs
**Priority: Low | Effort: 30min**
`docs/Known-Issues.md` is stale (still says "Sprint 1 in progress" under Open). Update it to reflect current state: resolved issues, remaining risks. Update Sprint-Log with Sprint 16 goals.

---

### Sprint 16 Summary

| # | Goal | Priority | Effort | Issue |
|---|------|----------|--------|-------|
| 1 | Project comments — schema + migration | High | 1-2h | #19 |
| 2 | Project comments — backend | High | 2-3h | #19 |
| 3 | Project comments — UI | High | 2-3h | #19 |
| 4 | Component tests for ProposalList/VoteButtons | High | 2-3h | — |
| 5 | Clean up dead code | Medium | 1h | — |
| 6 | SQLite backup automation | Medium | 1-2h | — |
| 7 | E2E test for CSRF rejection | Medium | 1h | — |
| 8 | Update Known-Issues + Sprint-Log docs | Low | 0.5h | — |

**Total estimated effort:** ~11-17 hours

**What's deliberately out of scope:**
- PostgreSQL migration (defer — SQLite works fine at current scale)
- Cloudflare deployment (Issue #13 — nice-to-have, not blocking)
- Redis-backed rate limiting (defer until multi-instance)
- JWT revocation store (acceptable risk at current user count)
- File upload/avatar support (not user-requested)
- Multi-tenancy/teams (requires PostgreSQL)

---

## Sprint 18 Goals

**Snapshot (2026-02-16):** 556 tests, 37 files, all green. `tsc --noEmit` clean. Coverage: 96.4% stmt / 88% branch. 1 open issue (#13 Cloudflare — nice-to-have). Sprint 17 completed all 7 goals (vote bar redesign, comment UI, migration fix).

Focus: **Update stale docs, harden middleware, improve coverage gaps, tick off achievable Nice-to-Have items.**

### Goal 1: Update Known-Issues.md — it's completely stale
**Priority: High | Effort: 30min**
`docs/Known-Issues.md` still says "Sprint 1 in progress" and "None yet" under Resolved. Rewrite Open section with current risks (in-memory rate limiter, no JWT revocation, middleware doesn't verify JWT). Move resolved items (CSRF, structured logging, backup automation) to Resolved. Remove risks that are already handled (session security, CSRF).

### Goal 2: Update Nice-to-Have.md — check off completed items
**Priority: High | Effort: 30min**
Many items are already done: PDF/CSV export, role-based access, audit logging, API rate limiting, search, structured logging, database backups, PWA. Check them off so the list reflects reality.

### Goal 3: Middleware JWT signature verification
**Priority: High | Effort: 2-3h**
Middleware currently checks cookie presence only (line 93-100), not signature. This is a defense-in-depth gap flagged since Sprint 16. Verify the JWT signature in middleware so unauthenticated requests are rejected early without reaching server actions. Add tests.

### Goal 4: Component tests for stat-card.tsx (71% branch coverage)
**Priority: Medium | Effort: 1-2h**
`stat-card.tsx` has 71% branch coverage — the lowest of any non-trivial component. Add RTL tests covering all conditional rendering branches (loading, empty, error states). Target 90%+ branch.

### Goal 5: Cover db/index.ts migration bootstrap paths (50% branch)
**Priority: Medium | Effort: 1-2h**
`src/db/index.ts` has 50% branch coverage. The uncovered paths (lines 60-61) are migration bootstrap edge cases. Add tests that exercise the missing-migration and first-run paths.

### Goal 6: Cover mail.ts SMTP config fallback paths (77% branch)
**Priority: Medium | Effort: 1h**
`src/lib/mail.ts` has 77% branch coverage. Uncovered lines (8-11, 15-16, 41) are SMTP config fallbacks. Add tests for missing/partial SMTP env vars to push branch coverage above 90%.

### Goal 7: Add rate limiting to proposals/votes/search endpoints
**Priority: Medium | Effort: 2-3h**
Only auth endpoints are rate-limited. Add rate limiting to mutation server actions (create/edit/delete proposals, vote, comment) and the search API. Use the existing in-memory rate limiter. This was flagged as Low severity but is easy to address now.

### Goal 8: Sprint 18 log entry in Sprint-Log.md
**Priority: Low | Effort: 15min**
Add Sprint 18 entry to `docs/wiki/Sprint-Log.md` with goals. Create `docs/wiki/Sprint-18.md` with goal checklist. Update after completion.

| # | Goal | Priority | Effort |
|---|------|----------|--------|
| 1 | Update Known-Issues.md | High | 30min |
| 2 | Update Nice-to-Have.md | High | 30min |
| 3 | Middleware JWT verification | High | 2-3h |
| 4 | Component tests for stat-card | Medium | 1-2h |
| 5 | Cover db/index.ts branches | Medium | 1-2h |
| 6 | Cover mail.ts branches | Medium | 1h |
| 7 | Rate limit proposals/votes/search | Medium | 2-3h |
| 8 | Sprint 18 log + checklist | Low | 15min |

**Total estimated effort:** ~9-13 hours

**Out of scope (same as Sprint 16-17):**
- PostgreSQL migration, Cloudflare deployment (#13), Redis rate limiter, JWT revocation, multi-tenancy

---

## Sprint 20 Goals

**Snapshot (2026-02-16):** 597 tests, 41 files, all green. `tsc --noEmit` clean. `npm audit`: 4 moderate (dev-only esbuild, unchanged). Coverage: 96.7% stmt / 90.0% branch / 98.3% func / 98.0% line. 2 open issues (#40 new logo, #13 Cloudflare). Sprint 19 ported all AI features from ideator.

Focus: **New logo integration, coverage gaps, remaining dead code, and production hardening.**

### Goal 1: Use new logo in header, favicon, and PWA manifest (Issue #40)
**Priority: High | Effort: 1-2h**
Issue #40 requests branding update. Replace current logo/icon in the header component, generate favicon set, and update `manifest.json` with new icons at required sizes.

### Goal 2: Cover csrf-client.ts (0% coverage)
**Priority: High | Effort: 1-2h**
`csrf-client.ts` has been at 0% stmt/branch/func since Sprint 16. It's a small file (lines 8-12) that reads CSRF tokens from cookies. Add JSDOM-compatible tests with mocked `document.cookie` to cover all paths.

### Goal 3: Cover proposals/actions.ts uncovered error paths (92% stmt)
**Priority: Medium | Effort: 1-2h**
`proposals/actions.ts` has uncovered lines at 166, 185, 189, 234 — error/validation paths. Add tests exercising these branches to push statement coverage above 97%.

### Goal 4: Cover auth.ts uncovered lines (83% branch)
**Priority: Medium | Effort: 1-2h**
`src/lib/auth.ts` has 83% branch coverage with uncovered lines 166, 232. Add tests for these edge cases (likely token expiry or session edge paths).

### Goal 5: Cover notifications.ts debounce edge cases (83% branch)
**Priority: Medium | Effort: 1h**
`src/lib/notifications.ts` has 83% branch coverage — uncovered lines at 25, 37, 46, 76, 100, 119. Add tests for debounce timing and notification dedup paths.

### Goal 6: Remove remaining dead code identified in Sprint 16
**Priority: Medium | Effort: 1h**
Check if these unused exports still exist: `buildProjectSummary` (ai.ts), `getAiUsageStats` (llm.ts), `getPermissions`/`requirePermission`/`canModifyResource` (rbac.ts), `sanitizeObject` (sanitize.ts). Remove any that remain unreferenced.

### Goal 7: Improve export.ts branch coverage (79% branch)
**Priority: Low | Effort: 1h**
`src/lib/export.ts` has 79% branch coverage with uncovered lines at 100, 127-148, 164. These are likely format-specific export paths. Add tests for all export format variations.

### Goal 8: Sprint 20 log entry in Sprint-Log.md
**Priority: Low | Effort: 15min**
Add Sprint 20 entry to `docs/wiki/Sprint-Log.md`. Create `docs/wiki/Sprint-20.md` with goal checklist. Update after completion.

| # | Goal | Priority | Effort | Issue |
|---|------|----------|--------|-------|
| 1 | New logo — header, favicon, PWA | High | 1-2h | #40 |
| 2 | Cover csrf-client.ts (0%) | High | 1-2h | — |
| 3 | Cover proposals/actions.ts errors | Medium | 1-2h | — |
| 4 | Cover auth.ts branches | Medium | 1-2h | — |
| 5 | Cover notifications.ts edges | Medium | 1h | — |
| 6 | Remove remaining dead code | Medium | 1h | — |
| 7 | Cover export.ts branches | Low | 1h | — |
| 8 | Sprint 20 log + checklist | Low | 15min | — |

**Total estimated effort:** ~8-12 hours

**Out of scope (same as prior sprints):**
- PostgreSQL migration, Cloudflare deployment (#13), Redis rate limiter, JWT revocation, multi-tenancy

---

## Sprint 23 Goals

**Snapshot (2026-02-16):** All tests passing. `tsc --noEmit` clean. Coverage: 98.4% stmt / 93.0% branch / 99.2% func / 99.2% line. 8 open issues (6 are future sprint plans, #40 logo, #13 Cloudflare). Sprint 22 completed all 11 goals (auth hardening, CSRF on auth routes, password toggle, modal proposal form).

**Theme: Dashboard — complete redesign, professional look (Issue #44)**

The current dashboard is functional but basic: four stat cards in a grid, four equal-weight list cards (projects, proposals, votes, activity). No visual hierarchy, no quick actions, no progress indicators, no charts/sparklines. The layout is identical on desktop and mobile. `StatCard` is a plain number-in-a-box with no trend data.

### Goal 1: Dashboard layout redesign — visual hierarchy and sections
**Priority: High | Effort: 2-3h**
Restructure `dashboard/page.tsx` into clear sections: hero/welcome area with quick actions at top, stats row, then a 2-column layout with primary content (projects, activity) given more weight than secondary (proposals, votes). Add section headings. Use spacing and card elevation to establish hierarchy.

### Goal 2: Quick actions bar — create project, browse projects, view profile
**Priority: High | Effort: 1-2h**
Add a quick actions section near the top of the dashboard with buttons/links for common tasks: "New Project", "Browse Projects", "My Profile". These should be prominent and reduce clicks to key flows.

### Goal 3: Enhanced StatCard — trend indicators, better visual design
**Priority: High | Effort: 2-3h**
Redesign `stat-card.tsx` to look professional: add subtle background gradients or color accents per metric, larger typography, and optional description/subtitle text. Consider adding "Your contributions" vs "Platform totals" distinction. Keep it accessible.

### Goal 4: Improve activity feed — icons per action type, timestamps, richer context
**Priority: Medium | Effort: 2-3h**
The activity feed currently only shows comments. Extend `queries.ts` to include recent proposals and votes in the feed as well (union query or separate queries merged client-side). Add distinct icons per action type (comment, proposal, vote). Show relative timestamps consistently.

### Goal 5: Mobile-first responsive polish
**Priority: High | Effort: 1-2h**
Audit every dashboard section at 320px, 375px, and 768px breakpoints. Stat cards should stack to 2x2 on small screens. Quick actions should be full-width buttons on mobile. Cards should stack single-column below `lg`. Test empty states on mobile.

### Goal 6: Empty state improvements — illustrations, clear CTAs
**Priority: Medium | Effort: 1-2h**
Current empty states are text-only with a muted icon. Add clearer call-to-action buttons (not just inline links) and more descriptive copy. Make the zero-data dashboard (new user) feel welcoming rather than bare.

### Goal 7: Dashboard loading state and error boundary
**Priority: Medium | Effort: 1h**
Review `dashboard/loading.tsx` — ensure it shows skeleton cards matching the new layout. Verify `dashboard/error.tsx` handles query failures gracefully. The loading state should match the redesigned layout shape.

### Goal 8: Exhaustive tests — component tests, mobile viewport E2E, accessibility
**Priority: High | Effort: 2-3h**
Add component tests for the redesigned dashboard (stat cards, quick actions, empty states, activity feed rendering). Add E2E tests at mobile viewport verifying layout and interactions. Run accessibility audit (axe-core) on the dashboard. All tests green before merge.

| # | Goal | Priority | Effort |
|---|------|----------|--------|
| 1 | Dashboard layout redesign | High | 2-3h |
| 2 | Quick actions bar | High | 1-2h |
| 3 | Enhanced StatCard design | High | 2-3h |
| 4 | Richer activity feed | Medium | 2-3h |
| 5 | Mobile-first responsive polish | High | 1-2h |
| 6 | Empty state improvements | Medium | 1-2h |
| 7 | Loading/error state updates | Medium | 1h |
| 8 | Exhaustive tests + accessibility | High | 2-3h |

**Total estimated effort:** ~12-19 hours

**Out of scope:**
- Real-time updates / WebSocket (Sprint 26+)
- Charts/sparklines with historical data (no time-series data stored yet)
- PostgreSQL migration, Cloudflare (#13), Redis rate limiter, JWT revocation

---

*Report updated for Sprint 23 planning at commit 3de0469 on main branch.*
