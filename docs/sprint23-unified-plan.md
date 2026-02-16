# Sprint 23 Unified Plan: Dashboard Redesign

**Issue:** #44
**Date:** 2026-02-16
**Sources:** Claude Opus 4.6 analysis + Codex analysis
**Budget:** ~50 Claude Code turns

---

## Analysis Agreement / Disagreement

### Both reports agree on

- The dashboard is a **data dump**, not a decision-making tool. Stats are platform-wide and not actionable for individual users.
- **No Quick Actions** exist anywhere on the dashboard. The only CTA is buried in empty states.
- **Mobile UX is poor** — four stat cards consume excessive vertical space before any real content appears. Search is hidden on mobile.
- **Activity feed is global** (all comments from all users), not scoped to the current user's projects or proposals.
- **Test coverage is critically low** — no authenticated dashboard E2E test, no unit tests for `getDashboardData()`, no component render tests.
- The `Header` makes a **redundant `/api/me` fetch** on every load when the server component already has the user.
- **Deadline visibility is absent** despite the `projects` table having a `deadline` column.
- Ideator's **project-centric card grid with deadline-first ordering** and per-project stats are worth borrowing.

### Where they disagree or diverge

| Topic | Claude | Codex |
|-------|--------|-------|
| **Raw SQL counts** | Acceptable at current scale, flag for future | P2 violation of project architecture rules — replace with Drizzle-native |
| **Error boundary** | Listed but not prioritized | P1 — `error.message` leaks internals to users |
| **Activity null links** | Not mentioned | P1 — `a.projectId` can be null, rendering `/projects/null` links |
| **Charts/sparklines** | Tier 2 recommendation (inline SVG sparklines) | Not mentioned |
| **Search API limit bug** | Not mentioned | P2 — negative `limit` param flows through |
| **Hardcoded "Unknown project"** | Not mentioned | Flagged as i18n risk |

---

## Sprint 23 Goals (prioritized)

### Phase 1 — Fix bugs and harden (Goals 1-3)

**Goal 1. Fix null-safe activity links and error leakage**
- Guard `a.projectId` null in activity feed links (`queries.ts` / `page.tsx`)
- Replace raw `error.message` in `error.tsx` with safe localized message
- Localize hardcoded `"Unknown project"` fallback label
- **Testable:** No `/projects/null` links render; error boundary shows generic message

**Goal 2. Scope activity feed to user-relevant data**
- Change `recentActivity` query to show comments on the user's own projects/proposals (not global firehose)
- Keep a "Platform activity" fallback if user has no projects yet
- **Testable:** Authenticated user sees only activity related to their projects/proposals

**Goal 3. Replace platform-wide stats with personal stats**
- Change stat cards from platform totals to user-specific: My Projects, My Proposals, My Votes, My Comments
- Add a secondary line showing platform total for context (e.g., "3 of 47")
- Add the missing `userCommentCount` query to `getDashboardData()`
- **Testable:** Stat card values change per logged-in user; different users see different numbers

### Phase 2 — Layout redesign (Goals 4-6)

**Goal 4. Add Quick Actions bar**
- Add a prominent action bar below stats: "New Project", "Browse Projects", "New Proposal" buttons
- Use existing `Button` + Lucide icons, link to `/projects/new`, `/projects`, `/projects` (with create flow)
- **Testable:** All 3 buttons visible on dashboard; each navigates to correct page

**Goal 5. Add deadline badges and urgency sorting to "Your Projects"**
- Show relative deadline on each project item (e.g., "3d left", "Overdue")
- Color-code: green (>7d), yellow (1-7d), red (overdue), grey (no deadline)
- Sort user's projects by deadline ascending (urgency-first), not `createdAt`
- **Testable:** Projects with deadlines show colored badges; overdue projects show red indicator

**Goal 6. Enrich "Your Projects" cards with per-project stats**
- Show inline counts per project: proposals, votes, comments (compact strip)
- Requires new subquery or joined aggregation in `getDashboardData()`
- **Testable:** Each project row shows proposal/vote/comment counts

### Phase 3 — Mobile optimization (Goals 7-8)

**Goal 7. Compact mobile stat display**
- On mobile (<640px), replace 4 full Card stat components with a compact 2x2 grid of stat pills (icon + number)
- Use `sm:hidden` / `hidden sm:grid` swap pattern
- Reduce above-the-fold scroll cost so actionable content appears within first viewport
- **Testable:** On 375px viewport, all 4 stats visible in ~100px height; Quick Actions visible without scrolling

**Goal 8. Improve mobile activity and search access**
- Add a mobile search entry point (icon button in mobile nav that opens search overlay)
- Increase `line-clamp` on activity items for mobile or use expandable rows
- **Testable:** Search accessible on 375px viewport; activity items show meaningful preview text

### Phase 4 — Testing (Goals 9-10)

**Goal 9. Dashboard E2E tests**
- Create `tests/e2e/dashboard.test.ts` covering:
  - Authenticated dashboard loads with stat cards, content cards
  - Quick Actions buttons present and navigable
  - Empty state renders correctly for new users
  - Deadline badges visible on projects with deadlines
  - Mobile viewport: compact stats, search access
- **Testable:** All new E2E tests pass in CI

**Goal 10. Unit tests for dashboard queries and components**
- Test `getDashboardData()` with mocked DB — all queries return expected shapes, handle empty results
- Test `StatCard` component render (not just `formatRelativeTime`)
- Test deadline badge color logic
- Test error boundary renders safe message
- **Testable:** Unit test coverage for dashboard files reaches >80%

### Phase 5 — Polish (Goals 11-12, if time permits)

**Goal 11. Replace raw SQL counts with Drizzle-native queries**
- Rewrite the 4 `sql\`(SELECT COUNT...)\`` subqueries in `queries.ts` using Drizzle's `count()` aggregation
- Aligns with project convention of avoiding raw SQL outside migrations
- **Testable:** Dashboard loads identically; no raw SQL strings in `queries.ts`

**Goal 12. Add "Projects Needing Attention" highlight**
- New card or section showing top 3 user projects by urgency (approaching deadline or most recent unresolved proposals)
- Visual treatment: yellow/red accent border
- **Testable:** Users with deadline-approaching projects see the highlight section; users without see nothing (no empty state noise)

---

## Out of Scope (future sprints)

These items surfaced in the analyses but are too large or low-priority for Sprint 23:

- Charts / sparklines / Recharts integration (needs library decision + design)
- Real-time activity feed via SSE/polling (needs new API route + client subscription)
- Dashboard sub-layout with tabs/sidebar (premature without more dashboard pages)
- Notification/alert system (needs DB table + delivery mechanism)
- Onboarding wizard for new users (nice-to-have, not core)
- PWA dashboard caching enhancements
- Search API negative-limit bug (valid but low-risk, separate fix)

---

## Execution Notes

- **Order matters:** Phase 1 (bugs/hardening) first because Phase 2 layout changes will touch the same files. Fixing bugs in the old code prevents carrying them into the new layout.
- **Testing in Phase 4** comes after the feature work so tests cover the redesigned dashboard, not the old one. However, the E2E test scaffolding (helpers, auth setup) should be started early if needed.
- **50-turn budget:** Phases 1-3 are the core deliverables (~35 turns). Phase 4 testing (~10 turns). Phase 5 polish uses remaining turns.
- **Mobile-first mindset:** All new components should be built mobile-first with progressive enhancement for desktop, not the other way around.
