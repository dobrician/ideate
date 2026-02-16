# Sprint 23 Analysis: Dashboard Redesign

**Issue:** #44 — Dashboard Redesign
**Date:** 2026-02-16
**Analyst:** Claude Opus 4.6
**Scope:** Full dashboard audit — pages, queries, components, tests, UX, performance, feature gaps

---

## 1. Current Dashboard State

### What exists (files and line counts)

| File | Lines | Role |
|------|-------|------|
| `src/app/dashboard/page.tsx` | 258 | Main page — async Server Component |
| `src/app/dashboard/queries.ts` | 86 | All 6 DB queries (Promise.all) |
| `src/app/dashboard/loading.tsx` | 40 | Skeleton loading state |
| `src/app/dashboard/error.tsx` | 39 | Client-side error boundary |
| `src/components/stat-card.tsx` | 52 | Reusable StatCard + formatRelativeTime |
| `src/components/header.tsx` | 153 | Sticky nav (Dashboard, Projects, Admin) |
| `src/components/app-shell.tsx` | 25 | Conditional header wrapper |

### What the dashboard renders today

1. **Title area** — "Dashboard" heading + "Welcome back, {name}" subtitle
2. **4 stat cards** (responsive grid: 1→2→4 cols) — Projects, Proposals, Total Votes, Comments. These are **platform-wide totals**, not user-specific.
3. **4 content cards** (2-col grid on lg):
   - **Your Projects** — 5 most recent, with status badges and "View all" link. Empty state with "Create one" CTA.
   - **Your Proposals** — 5 most recent, with parent project name. Empty state.
   - **Your Recent Votes** — 8 most recent, color-coded thumbs up/down icons linked to proposals. Empty state.
   - **Recent Activity** — 10 latest comments **platform-wide** (not user-scoped), with commenter name, proposal title, relative time, and content preview (1-line clamp).

### What does NOT exist

- No dashboard sub-layout (`dashboard/layout.tsx`) — shares root layout only
- No Quick Actions widget (no "New Project" / "New Proposal" buttons)
- No charts or data visualization (despite CSS variables `--chart-1` through `--chart-5` being defined in globals.css)
- No search/filter on the dashboard
- No pagination (hard limits: 5/5/8/10)
- No "trending" or "hot proposals" section
- No deadline/urgency indicators
- No personal stats (my vote count, my comment count, my engagement rate)
- No onboarding guidance for new users beyond empty states
- No notification or alert system

### Data architecture

All data fetched server-side via `getDashboardData(userId)` — a single `Promise.all` with 6 parallel Drizzle queries. No API route needed. Returns:
- `userProjects` — 5 latest by `createdAt DESC`
- `userProposals` — 5 latest, joined with projects for title
- `userVoteCount` — aggregate count
- `recentVotes` — 8 latest, joined with proposals for title/projectId
- `recentActivity` — 10 latest comments (all users), joined with users + proposals
- `stats` — 4 raw SQL COUNT subqueries (platform-wide)

---

## 2. UX Assessment

### Layout

**Good:**
- Clean, consistent use of shadcn Card components
- Logical information hierarchy: stats at top, details below
- Container is `max-w-6xl` with `px-4 py-8` — well-constrained
- Empty states have icons, explanatory text, and CTAs

**Problems:**
- **No visual weight differentiation.** All 4 content cards look identical — same size, same spacing, same font. There's no visual signal about which card matters most to the user right now.
- **No call-to-action prominence.** The only primary action is buried in the empty state of "Your Projects." There's no persistent "New Project" or "New Proposal" button visible when the user already has data.
- **The 2x2 grid on large screens creates dead space** when content cards have uneven item counts (e.g., 5 projects vs. 3 activity items). The shorter card leaves a gap.
- **Stat cards show platform-wide numbers** which are meaningless for individual users on a small team. "Total Votes: 247" tells you nothing actionable. Users need *their own* contribution stats.

### Responsiveness

**Good:**
- Stats grid: `sm:grid-cols-2 lg:grid-cols-4` — proper breakpoint progression
- Content grid: `lg:grid-cols-2` — stacks on mobile
- Text truncation with `truncate` and `line-clamp-1` prevents overflow

**Problems:**
- **No mobile-specific dashboard view.** The mobile layout is just a vertical stack of all 8 elements (4 stats + 4 cards). On a phone, the user scrolls past 4 stat cards before reaching actionable content.
- **Stat cards on mobile take excessive vertical space.** Each stat card is a full Card component with header + content. On a 375px screen, the 4 stat cards consume ~400px of vertical space before any content appears.
- **No collapsible sections.** On mobile, users can't collapse "Recent Votes" if they only care about their projects.

### Accessibility

**Good:**
- `role="region"` with `aria-label="Platform statistics"` on stat grid
- `role="list"` on all `<ul>` elements
- `aria-label` on stat values, `aria-hidden` on decorative icons
- Semantic heading hierarchy (h1 for title, CardTitle for sections)

**Missing:**
- No skip-to-content link for keyboard users
- No `aria-live` region for dynamically loaded content
- Activity feed timestamps lack `<time>` with `datetime` — wait, they do have it. Good.
- Status badges use color alone without text-level semantics for screen readers (though `statusLabel` provides text)

---

## 3. Performance Concerns

### Current performance profile

**Good:**
- Server Component — zero client-side JS for the dashboard page itself
- Single `Promise.all` with 6 parallel queries — no waterfall
- No client-side data fetching on the dashboard (Header's `/api/me` is the only client fetch)
- Skeleton loading.tsx matches layout exactly — minimal CLS
- SQLite with WAL mode — fast reads

**Concerns:**

1. **Stats queries use raw SQL COUNT subqueries on every page load.** Each of these scans the entire table:
   ```sql
   (SELECT COUNT(*) FROM projects)
   (SELECT COUNT(*) FROM proposals)
   (SELECT COUNT(*) FROM votes)
   (SELECT COUNT(*) FROM comments)
   ```
   With <10K rows this is fine on SQLite. At scale (100K+ votes, 50K+ comments), these will degrade. No caching layer exists.

2. **No query result caching.** Every dashboard load runs 6 DB queries. Next.js Server Components with `dynamic = "force-dynamic"` (which this appears to use implicitly via `getCurrentUser()` cookie reads) skip the RSC cache entirely. There's no `unstable_cache` or ISR.

3. **The `recentActivity` query** joins comments → users → proposals across all platform data. This will grow linearly with total comment volume.

4. **Header component makes a client-side fetch to `/api/me`** on every navigation, including dashboard load. This is a redundant round-trip — the server component already has the user via `getCurrentUser()`. The Header should receive user data via props or context instead of fetching independently.

5. **No bundle analysis evidence of dashboard-specific JS.** Since the page is a Server Component, the JS cost is minimal. The main cost is in shared components (Header, DarkModeToggle, SearchBar, etc.). No concern here.

### Recommendation
At the current scale (SQLite, single-server), performance is fine. The optimizations above become relevant when migrating to PostgreSQL or supporting >100 concurrent users.

---

## 4. Missing Features

### 4.1 Personal Stats (high impact)

The current stat cards show **platform-wide** counts. Users need to see:
- **My Projects** count (owned)
- **My Proposals** count (submitted)
- **My Votes** count (already fetched as `userVoteCount` but not displayed prominently)
- **My Comments** count (not fetched at all)

A "your stats vs. platform stats" comparison would show users their engagement level.

### 4.2 Quick Actions Widget (high impact)

There is no persistent call-to-action. Missing:
- **"New Project"** button (exists only in header nav on Desktop, and only as a page link)
- **"Browse Projects"** button
- **"View All Projects"** already exists as a small link in the Projects card header — but it's easy to miss

A prominent Quick Actions bar or floating action button would improve task completion rates.

### 4.3 Activity Feed Improvements (medium impact)

Current feed shows only comments. Missing activity types:
- New project created
- New proposal submitted
- Vote cast (on user's proposals)
- Project status changed
- Deadline approaching

The feed is also platform-wide with no filter for "activity on my stuff."

### 4.4 Project Deadline/Urgency Indicators (medium impact)

The ideator app sorts projects by deadline and visually greys out past-deadline cards. Ideate's dashboard shows projects sorted by `createdAt` with no deadline visibility at all. Users can't see which projects need attention.

### 4.5 Charts and Trends (medium impact)

CSS variables `--chart-1` through `--chart-5` are defined but unused. No charting library is installed. Potential visualizations:
- Votes over time (line or bar chart)
- Proposal activity per project (bar chart)
- User engagement trend (sparkline in stat cards)
- Vote distribution (pie/donut)

These would require adding a lightweight library like Recharts (~45KB gzipped) or using pure CSS/SVG for sparklines.

### 4.6 Notification/Alert System (low-medium impact)

No way for users to know when:
- Someone commented on their proposal
- A project they participate in has a deadline approaching
- Their proposal received new votes

This is a larger feature (requires DB table + polling/SSE) but the dashboard would be the natural home for a notification indicator.

### 4.7 Search on Dashboard (low impact)

The global SearchBar exists in the header. No dashboard-specific search. For most users this is probably fine — the header search covers it.

---

## 5. Test Coverage Gaps

### What's tested

| Test File | What it covers |
|-----------|---------------|
| `tests/unit/stat-card.test.ts` (73 lines) | `formatRelativeTime` — 7 base cases + 4 i18n cases |
| `tests/unit/header.dom.test.tsx` (268 lines) | Header rendering, Dashboard nav link, active state, admin visibility |
| `tests/e2e/auth.test.ts` (line 61-64) | Dashboard redirects unauthenticated users to /auth/login |
| `tests/e2e/navigation.test.ts` (line 17-19) | Homepage has a "Dashboard" link |

### What's NOT tested

| Gap | Risk Level |
|-----|-----------|
| `getDashboardData()` query function — zero test coverage | **High** — 6 parallel queries with joins, no verification that they return correct data |
| `DashboardPage` component render — no unit/integration test | **High** — 258 lines of rendering logic with conditional branches, empty states, and i18n |
| Authenticated dashboard E2E — no test visits `/dashboard` while logged in | **High** — the most important user flow (seeing your data) is completely untested |
| StatCard React component render — not tested | **Medium** — only formatRelativeTime is tested from stat-card.tsx |
| Dashboard loading.tsx skeleton — not tested | **Low** — simple static component |
| Dashboard error.tsx boundary — not tested | **Medium** — error recovery path is untested |
| Empty states rendering correctly | **Medium** — 4 different empty state branches, none tested |
| Mobile layout regression — no viewport-specific test | **Medium** — responsive breakpoints could break silently |

### Test coverage estimate
- **Unit coverage of dashboard code:** ~15% (only formatRelativeTime from the entire dashboard surface)
- **E2E coverage of dashboard flows:** ~5% (only the redirect-when-unauthenticated path)

---

## 6. Comparison with Ideator App

The original ideator app at `/home/dc/work/ideator` takes a fundamentally different dashboard approach.

### Ideator dashboard design

| Aspect | Ideator | Ideate |
|--------|---------|--------|
| **Layout** | Flat grid of project cards (auto-fit, minmax 280px) | 4 stat cards + 2x2 content cards |
| **Focus** | Project-centric — each card IS a project | User-centric — your projects, your proposals, your votes |
| **Stats shown** | Per-project inline (proposals, upvotes, downvotes, comments) | Platform-wide aggregates |
| **Sorting** | By deadline ascending (urgency-first) | By createdAt descending (newest-first) |
| **Deadline visibility** | Prominent badge on every card + greyed-out past-deadline cards | Not shown at all |
| **Quick actions** | "New Project" button at top-right of dashboard | No quick actions |
| **AI features** | Summary previews on cards, "Suggest Proposals" on project pages | Not on dashboard |
| **Empty state** | Dashed border box with CTA | Icon + text + "Create one" link |
| **Visualization** | CSS gradient vote bars in proposal accordion | None |
| **Auth** | WorkOS SSO | JWT magic link + password |
| **Data loading** | Single query with correlated subqueries | 6 parallel queries via Promise.all |
| **Charting** | None (CSS-only vote bars) | None (unused chart CSS variables) |
| **My Projects page** | Stub (not implemented) | Exists at /projects |
| **My Contributions** | Stub (not implemented) | Tracked via dashboard cards |

### Key takeaway

Ideator's dashboard is essentially a **project browser** — it shows all projects as cards and lets users dive in. Ideate's dashboard is a **personal cockpit** — it shows the user their own data across the platform.

Ideate's approach is more sophisticated but needs work on:
1. **Urgency signals** — Ideator's deadline-first sorting is better for prioritization apps
2. **Quick actions** — Ideator has a persistent "New Project" button
3. **Per-project stats** — Ideator shows proposal/vote/comment counts per project card; Ideate only shows user's recent projects as a text list

The two approaches could be combined: keep Ideate's personal cockpit design but add urgency indicators and per-item stats.

---

## 7. Prioritized Recommendations

### Tier 1: High Impact, Low Effort (do first)

**1. Add Quick Actions bar** — Below the stats grid, add a horizontal bar with 2-3 prominent buttons: "New Project", "Browse Projects", and optionally "View All Proposals". Use `Button` components with icons. ~30 min.

**2. Replace platform-wide stats with personal + platform stats** — Change the stat cards to show "My X / Total X" (e.g., "3 / 47 Projects"). Requires 4 additional COUNT queries filtered by userId. Data is already partially available (`userVoteCount`). ~1 hour.

**3. Add deadline badges to "Your Projects" list** — Show relative deadline (e.g., "3d left", "Overdue") next to each project's status badge, with color coding (green → yellow → red). The `projects` table already has a `deadline` column, and `userProjects` already fetches it. ~30 min.

**4. Compact stat cards on mobile** — Replace the 4 full Card components on mobile with a single 2x2 grid of compact stat pills (icon + number, no Card wrapper). Use a `sm:hidden` / `hidden sm:grid` swap. ~30 min.

### Tier 2: High Impact, Medium Effort

**5. Add "Projects Needing Attention" card** — A new card showing the user's projects ordered by deadline, with visual urgency indicators (approaching deadline in yellow, overdue in red). Max 3-5 items. New query: user's projects with upcoming/past deadlines. ~1-2 hours.

**6. Enrich the activity feed** — Expand from comments-only to include proposals and votes. Add filter tabs: "All", "My Projects", "My Proposals". Requires modifying the `recentActivity` query to union multiple entity types. ~2-3 hours.

**7. Add sparkline or progress indicators to stat cards** — Small inline SVG sparklines showing trend (e.g., votes this week vs. last week). No external library needed — 20-30 lines of SVG generation. Makes stats feel dynamic instead of static. ~2 hours.

**8. Write dashboard E2E tests** — Create `tests/e2e/dashboard.test.ts` covering: authenticated dashboard loads, stat cards show data, content cards render items, empty states render correctly, navigation from dashboard to projects. ~2-3 hours.

### Tier 3: Medium Impact, Medium-High Effort

**9. Write unit tests for `getDashboardData()`** — Test with mocked DB: correct query construction, correct field selection, empty results handling. Cover all 6 parallel queries. ~2 hours.

**10. Add a "Top Proposals" or "Trending" section** — Show the top 5 proposals by vote count across all active projects. New query: proposals ordered by net votes (upvotes - downvotes) from active projects. ~2 hours.

**11. Add dashboard sub-layout** — Create `src/app/dashboard/layout.tsx` with a sidebar or tab navigation for dashboard sub-pages (Overview, My Projects, My Activity, Analytics). Enables future expansion without bloating the main page. ~1-2 hours.

**12. Implement per-project stat badges in "Your Projects" card** — Show small counts (proposals, votes) next to each project title, similar to ideator's card stats. The data isn't currently fetched — requires joining or subquerying counts per project. ~1-2 hours.

### Tier 4: Nice to Have, Higher Effort

**13. Add a charting library and build an engagement chart** — Install Recharts or lightweight alternative. Show a "Your activity over the last 30 days" line chart (votes + comments per day). Requires new time-series query. ~3-4 hours.

**14. Progressive Web App dashboard enhancements** — The app already has PWA support (`PwaInstall`, `ServiceWorkerRegistration`). Add dashboard data pre-caching so the dashboard loads instantly from cache on repeat visits. ~2-3 hours.

**15. Real-time activity feed** — Use Server-Sent Events or polling (every 30s) to keep the activity feed live without page reload. New API route + client-side subscription. ~4-5 hours.

**16. Onboarding wizard for empty dashboards** — When all sections are empty (new user), show a step-by-step guide: "1. Browse projects → 2. Submit a proposal → 3. Vote on ideas". Replace the 4 identical empty states with a single guided flow. ~2-3 hours.

---

## Summary

The Ideate dashboard has solid foundations: server-side rendering, parallel data fetching, i18n, skeleton loading, error boundary, and clean shadcn/ui styling. But it reads as a **data dump** rather than a **decision-making tool**. The key transformation is shifting from "here's what exists on the platform" to "here's what needs your attention right now."

The highest-leverage changes are:
1. Quick Actions bar (unblocks user workflows)
2. Personal stats (shows users their impact)
3. Deadline indicators (drives urgency)
4. Mobile optimization (50%+ of users)
5. E2E test coverage (prevents regressions during the redesign)

These 5 items would make the dashboard genuinely useful. The remaining items add polish and depth.
