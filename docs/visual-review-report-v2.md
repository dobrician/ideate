# Visual Design Review Report v2

**Date:** February 17, 2026
**Reviewed by:** Claude (automated visual review)
**Screenshots:** 55 total (mobile + desktop, light + dark, all pages)
**Source:** `tests/visual-review/screenshots/resized/`
**Comparison baseline:** `docs/visual-review-report.md` (v1, same date)

---

## Table of Contents

1. [v1 vs v2 Comparison Summary](#v1-vs-v2-comparison-summary)
2. [Page-by-Page Findings](#page-by-page-findings)
3. [Cross-Cutting Issues](#cross-cutting-issues)
4. [Priority Fix Plan](#priority-fix-plan)

---

## v1 vs v2 Comparison Summary

### Fixed Since v1 (13 items resolved)

| v1 ID | Issue | Status |
|-------|-------|--------|
| CC-1 / P1-1 | Dark mode button invisibility (auth pages) | **FIXED** -- Primary buttons now use green fill in dark mode across all auth pages |
| P1-4 | Delete button too prominent on project detail | **FIXED** -- Delete is now behind a "..." overflow menu |
| P1-6 | Profile page excessively long (no tabs) | **FIXED** -- Profile now uses tabs: Account, Security, My Projects, My Proposals |
| CC-5 / P2-2 | Forgot-password page missing "Ideate" branding | **FIXED** -- "Ideate" brand text now appears on forgot-password |
| P2-5 | Project card height variance | **FIXED** -- Cards now have consistent min-height in the grid |
| P2-11 | Admin "Name" column shows "--" em-dashes | **FIXED** -- Now shows "Not set" in muted text |
| P2-13 | Dark mode create-project card has no border | **FIXED** -- Card borders visible in dark mode |
| P3-1 | Home feature cards not centered (bottom row) | **FIXED** -- Bottom row of 2 cards is now centered on desktop |
| P3-4 | 404 button hierarchy (both outline) | **FIXED** -- "Go Home" is filled green, "View Projects" is outline |
| P3-5 | No profile avatar placeholder | **FIXED** -- Avatar circle with initial letter now appears in Account section |
| P3-6 | Countdown timer shows precise seconds | **FIXED** -- Now shows "30 days left" instead of "29d 23:59:30" |
| P3-8 | Pagination lacks context text | **FIXED** -- Now shows "Showing 1-12 of 34 projects" |
| P3-10 | Comment send button lacks tooltip | **Likely FIXED** -- Button appears to have tooltip affordance (not verifiable from screenshot alone) |

### Still Open from v1 (7 items remain)

| v1 ID | Issue | Status |
|-------|-------|--------|
| P0-1 | 404 light-mode screenshots show login page | **STILL BROKEN** -- Screenshots 17-18 still show login page, not 404. The unauthenticated 404 route redirects to login. |
| P1-2 | Duplicate proposal form on project detail (desktop) | **STILL BROKEN** -- Sidebar form AND bottom full-width "New Proposal" form both visible. A second "Project Discussion" section also duplicated below the fold. |
| P1-5 | Admin mobile table illegibility | **PARTIALLY FIXED** -- "Not set" replaces "--" but long emails still truncate heavily on mobile. Audit log remains dense. |
| CC-2 / P2-1 | Mobile navbar tap target density | **UNCHANGED** -- 5 icons still packed tightly in the mobile navbar |
| P2-7 | Admin search filters global nav, not user table | **STILL BROKEN** -- Screenshot 46 shows "e2e" in global search with "No results found" while table below is unaffected |
| CC-3 / P2-4 | Text truncation inconsistency | **PARTIALLY FIXED** -- Title tooltips added in Sprint 32 (per commit history), but dashboard proposal names still lack project context |
| P2-12 | Dark mode outline button borders faint | **FIXED for primary buttons** -- "Sign in with Magic Link" outline button border is now more visible |

### New Issues Found in v2

See page-by-page findings below for new issues not present in v1.

---

## Page-by-Page Findings

### 1. Home / Landing Page (01-04)

**Screenshots:** `01-home-mobile-light` through `04-home-desktop-dark`

**What's Good:**
- Clean hero section with "Welcome to Ideate" heading, description, and dual CTAs
- Feature cards use a 3+2 grid on desktop; bottom row is now **centered** (v1 P3-1 fixed)
- Mobile stacks cards vertically with clean spacing
- Dark mode has visible card borders with good contrast
- Green "Get Started" CTA stands out well in both themes

**Issues:**
- **[P2]** Mobile navbar still packs 5 icons tightly (search, globe/EN, theme toggle, user icon) -- tap targets may be under the recommended 44px minimum
- **[P3]** Light mode feature cards have very subtle borders/shadows -- could benefit from slightly more definition against the white background

---

### 2. Login Page (05-10)

**Screenshots:** `05-login-empty-mobile-light` through `10-login-mobile-dark`

**What's Good:**
- Centered card layout works well on both viewports
- Clear hierarchy: "Ideate" brand, "Sign in to Ideate" title, subtitle, form, CTAs
- Validation states (07-08) show red borders + red error text correctly
- Dark mode buttons now use **green fill** -- major improvement over v1 where buttons were invisible
- "Sign in with Magic Link" outline button has better border visibility in dark mode
- Password visibility toggle (eye icon) present
- "Forgot password?" link well-placed

**Issues:**
- **[P3]** The "Sign In with Password" button in light mode uses a black fill that, while functional, doesn't match the green brand color used elsewhere (Get Started, dark mode buttons)

---

### 3. Register Page (11-14, 52-53)

**Screenshots:** `11-register-empty-mobile-light` through `53-register-mobile-dark`

**What's Good:**
- Consistent card style with login page
- Password requirements hint visible below password field
- Validation state (13-14) shows all three fields with red borders and appropriate messages
- Dark mode: "Create Account" button uses green fill (v1 P1-1 fixed)
- Mobile layout is clean with good spacing between fields

**Issues:**
- **[P2]** Desktop register form (12) spacing between Password and Confirm Password fields is tighter than between Email and Password -- inconsistent vertical rhythm
- **[P3]** No password strength indicator beyond static hint text

---

### 4. Forgot Password Page (15-16, 50-51)

**Screenshots:** `15-forgot-password-mobile-light` through `51-forgot-password-mobile-dark`

**What's Good:**
- "Ideate" branding now present at top of card (v1 CC-5 fixed)
- Clean, minimal form -- email field + submit + back link
- Dark mode "Send Reset Link" button uses green fill (v1 CC-1 fixed)
- Card centered well on desktop dark mode (50)

**Issues:**
- **[P2]** Mobile light mode (15): card is pushed down with significant empty space above -- should be vertically centered or positioned higher (unchanged from v1)

---

### 5. 404 Page (17-18, 54-55)

**Screenshots:** `17-404-mobile-light`, `18-404-desktop-light`, `54-404-desktop-dark`, `55-404-mobile-dark`

**CRITICAL:** Screenshots 17-18 (labeled as "404 light mode") still show the **login page**, not a 404 page. This is the same P0 issue from v1 -- the `/this-page-does-not-exist-404` route redirects unauthenticated users to login.

**What's Good (54-55, dark mode, captured as authenticated user):**
- Bold "404" heading is prominent
- Clear description: "The page you're looking for doesn't exist or has been moved."
- "Go Home" uses green filled button, "View Projects" uses outline -- proper button hierarchy (v1 P3-4 fixed)
- Navbar visible for navigation
- Card has visible border in dark mode

**Issues:**
- **[P0]** Light-mode 404 screenshots still show login page. The test captures 404 before login, so the route guard redirects. Fix: capture 404 page after login, or exempt 404 from auth redirect.
- **[P2]** 404 dark mode text ("The page you're looking for...") is somewhat gray/muted -- could use slightly brighter text for readability

---

### 6. Dashboard (19-22)

**Screenshots:** `19-dashboard-mobile-light` through `22-dashboard-desktop-dark`

**What's Good:**
- Strong information hierarchy: stat cards (My Projects, My Proposals, My Votes, My Comments) at top, then content sections
- Stat cards show count + "of X total" context (e.g., "5 of 34 total")
- Desktop 4-column stat row with icons is clean
- Mobile displays stat chips in a horizontal row -- compact and readable
- "New Project" and "Browse Projects" CTAs are prominent with icons
- Project list shows name, stats (proposals, votes, comments), "30d left" badge, "Active" status
- Dark mode has good contrast; cards and sections are clearly separated
- "View all" link on "Your Projects" section (v1 P3-7 addressed)

**Issues:**
- **[P2]** "Your Recent Votes" section shows "Initial Test Proposal" repeated 8 times with colored vote icons but no project context -- in production, this section would be confusing if multiple proposals share names
- **[P2]** "Your Proposals" section shows proposals "in E2E Test Project 177..." with truncated project IDs -- the truncation is functional but the long ID makes it hard to evaluate real-world readability
- **[P2]** "Recent Activity" section shows only one entry ("e2e-test@ideate.local commented on 6h ago") -- the empty state is abrupt. A "View all activity" link would help
- **[P3]** Mobile (19): stat chip labels are quite small ("5 My Projects", "5 My Proposals") -- the count is clear but the label text is tight
- **[NEW P2]** Dashboard page is still quite long on mobile -- "Your Projects" (5 items), "Your Proposals" (5 items), "Your Recent Votes" (8 items), and "Recent Activity" all stack vertically without collapse. Consider limiting visible items to 3 with "Show more" links.

---

### 7. Projects List (23-25)

**Screenshots:** `23-projects-list-mobile-light` through `25-projects-list-desktop-dark`

**What's Good:**
- Desktop uses 3-column card grid with consistent card heights (v1 P2-5 fixed)
- Each card shows: name (truncated), "Active" badge, description preview, deadline, creation date
- Search bar + filter controls (status dropdown, sort) present
- **Pagination now shows "Showing 1-12 of 34 projects"** (v1 P3-8 fixed)
- "Create Project" button is prominent (green, top-right)
- Mobile stacks cards vertically with full-width layout
- Dark mode cards have visible borders and good contrast
- Pagination with numbered pages and arrows is clean

**Issues:**
- **[P2]** Mobile (23): the page is very long with all projects listed vertically. Project names with long IDs cause title wrapping to 2-3 lines
- **[P2]** The "All statuses" filter dropdown is small and could be overlooked on desktop
- **[P3]** Desktop card descriptions all read "A project created for automated E2E testing" identically -- no truncation issues visible here, but with varied descriptions some cards could have more text than others affecting row alignment

---

### 8. Create Project (26-28, 49)

**Screenshots:** `26-create-project-mobile-light` through `49-create-project-desktop-dark`

**What's Good:**
- Clean form with labeled fields: Project Title*, Description, Deadline*, Status
- Required fields marked with red asterisks
- Helpful hint text below each field
- Validation state (28) shows red borders and error messages
- "Create Project" (primary) and "Cancel" (secondary) buttons clearly differentiated
- Dark mode form has visible borders and green "Create Project" button (v1 P2-13 fixed)
- Good placeholder text examples ("Q1 2026 Product Roadmap")

**Issues:**
- **[P3]** Date picker uses native browser `mm/dd/yyyy` format -- fine for now but may vary across browsers
- **[P3]** "Cancel" button is styled as plain text next to the filled button -- acceptable but could benefit from slightly more visual weight

---

### 9. Project Detail (29-34)

**Screenshots:** `29-project-detail-mobile-light` through `34-proposal-expanded-mobile-light`

**What's Good:**
- Clear page structure: back navigation, project title, action buttons, status badge, description, proposals, discussion
- Delete button is now behind a "..." overflow menu (v1 P1-4 fixed)
- Countdown shows "30 days left" in a badge (v1 P3-6 fixed)
- Action buttons (PDF, CSV, Edit) are clean with icons
- Proposal row shows title, author (truncated), vote bar with green gradient, vote/comment counts
- Expanded proposal (33-34) shows description, "Show full description" link, date, and Delete action
- "New Proposal" sidebar form on desktop is well-positioned with Title, Description, Pro/Contra toggle
- Vote bar fill looks proportional (v1 P2-6 may be improved)
- Dark mode has dark card borders visible (v1 improvement)
- Mobile "+ New" button is no longer clipped (v1 P1-3 fixed)

**Issues:**
- **[P1]** **Duplicate content below the fold:** On desktop (30, 32, 33, 37, 38), scrolling past the main project card reveals a SECOND "Project Discussion (0)" section with its own comment input, AND a second "New Proposal" form (Title, Description, Pro/Contra, Submit). Both are full-width duplicates of the sidebar form and in-card discussion. This is the same issue as v1 P1-2 and is still the biggest UX problem on this page.
- **[P2]** Proposal author email ("by e2e-test@ideat...") is truncated with no visible tooltip in some views
- **[P2]** The "Details" link in the proposal row is small and easily missed
- **[NEW P2]** Mobile project detail (29, 34) is very tall due to the duplicate sections. The page extends well below the visible content, repeating discussion + form sections unnecessarily.

---

### 10. AI Suggestions Modal (35-36)

**Screenshots:** `35-ai-suggestions-modal-desktop-light`, `36-ai-suggestions-modal-mobile-light`

**What's Good:**
- Modal overlay dims background appropriately
- Clear title "AI Suggestions" with subtitle
- **Skeleton loading placeholders** now shown during loading (v1 P3 improvement -- previously just a spinner)
- Three skeleton cards visible, indicating expected content shape
- Close button (X) visible in top-right
- "Generating suggestions..." text with spinner

**Issues:**
- **[P2]** Desktop (35): modal is medium-sized but the skeleton placeholders make it feel more complete than v1. However, the page content behind the modal (expanded proposal, delete button) is somewhat distracting through the overlay
- **[P2]** Mobile (36): the modal takes up most of the screen but some content bleeds through at the bottom (proposal row visible below the modal)

---

### 11. Proposal Sidebar Form + Comments Section (37-38)

**Screenshots:** `37-proposal-sidebar-form-desktop-light`, `38-comments-section-desktop-light`

These screenshots are visually identical to the expanded proposal view (33) since the sidebar form is always visible on desktop. The duplicate form/discussion section below the fold is clearly visible when scrolled.

**Issues:**
- Same as Project Detail P1 (duplicate content) above.
- **[P2]** "Submit Proposal" button in sidebar is right-aligned and somewhat disconnected from the form fields above it

---

### 12. Profile Page (39-42, 47-48)

**Screenshots:** `39-profile-mobile-light` through `48-profile-mobile-dark`

**What's Good:**
- **Tabbed navigation** with Account, Security, My Projects, My Proposals (v1 P1-6 FIXED -- major improvement)
- **Avatar circle** with initial letter ("E") and email displayed (v1 P3-5 fixed)
- Account info shows Email, Role, Member Since, Display Name in clean grid
- Edit Profile section with First Name / Last Name side-by-side on desktop
- "Save Changes" button uses green fill in dark mode
- Dark mode has visible card borders and good contrast
- Mobile tabs are horizontally scrollable
- Page is now a reasonable length -- only the Account tab content is visible, not all sections stacked

**Issues:**
- **[P2]** Screenshots 41-42 ("change-password") show the same Account tab view as 40/39 -- the test doesn't navigate to the Security tab, so we have no screenshot of the Change Password form. This is a test gap, not a UI issue.
- **[P3]** The "Save Changes" button in light mode uses black fill which doesn't match the green brand color used in dark mode and on the home page "Get Started" button

---

### 13. Admin Panel (43-46)

**Screenshots:** `43-admin-mobile-light` through `46-admin-search-desktop-light`

**What's Good:**
- Stat cards at top (Users 64, Projects 34, Proposals 45, Votes 47) with icons
- User management table with Email, Name, Role, Joined columns
- "Not set" in muted text replaces "--" em-dashes (v1 P2-11 fixed)
- Role column shows "Member" with dropdown chevron for editing
- Pagination: "1-20 of 64 users"
- Dark mode (45) has excellent contrast with clear row separation
- Recent Activity / audit log at bottom with event type badges and timestamps

**Issues:**
- **[P1]** Mobile (43): admin page is extremely long. User table becomes a stacked card format with heavily truncated emails ("smokepass07710...") that are hard to read. The audit log section at the bottom is dense and nearly illegible on mobile.
- **[P2]** Admin search (46): searching "e2e" shows "No results found" in the **global** search dropdown while the user table below is unaffected. The search filters the wrong element -- users expect the search to filter the user table, not trigger global search. (Unchanged from v1 P2-7)
- **[P2]** Audit log timestamps could use relative format ("2h ago" is used in some entries but full datetime in others -- inconsistent)
- **[P3]** Stat cards could be clickable to navigate to filtered views (v1 P3-11, partially addressed -- stat cards now link per Sprint 32 commit notes, but hard to verify from screenshots alone)

---

## Cross-Cutting Issues

### CC-1: Duplicate Content on Project Detail Page (P1)
**Affects:** Project Detail (desktop and mobile)
**Problem:** Below the main project card content, the page renders a second "Project Discussion" section with its own comment input, AND a second "New Proposal" form. On desktop, this means users see the sidebar form AND a full-width form. On mobile, the duplicate sections make the page unnecessarily long.
**Fix:** Hide the bottom-of-page form/discussion sections. On desktop, only show the sidebar form. On mobile, only show the "+ New" dialog trigger. The discussion section should appear once, inside the project card.
**Files:** Project detail page component, likely `src/app/projects/[id]/page.tsx` or related layout.

### CC-2: Mobile Navbar Tap Target Density (P2)
**Affects:** All pages
**Problem:** The mobile navbar packs 5 interactive elements (logo link, search icon, globe/EN, theme toggle, user icon) into a narrow row. Tap targets may fall below the recommended 44px minimum.
**Status:** Unchanged from v1.
**Fix:** Group language + theme into a settings dropdown, or reduce icon count on mobile.

### CC-3: Light-Mode 404 Route Redirect (P0)
**Affects:** 404 page test captures
**Problem:** The test captures the 404 page before authentication, but the route redirects unauthenticated users to login. This means we have no light-mode 404 screenshot.
**Fix:** Either capture 404 after login (move 404 capture into the authenticated section of the test), or exempt the 404/not-found route from auth redirects so unauthenticated users see the 404 page.

### CC-4: Light-Mode Primary Button Color Inconsistency (P3)
**Affects:** Login, Register, Forgot Password, Profile, Create Project (all in light mode)
**Problem:** In dark mode, primary action buttons use the green brand color. In light mode, they use plain black fill. This creates a visual inconsistency between themes -- the brand identity (green) is only expressed in dark mode buttons.
**Not a bug:** The black buttons are functional and have good contrast. This is a branding consistency observation.

### CC-5: Dashboard + Admin Page Length on Mobile (P2)
**Affects:** Dashboard, Admin Panel
**Problem:** These pages stack many sections vertically without collapse or "show more" patterns. Dashboard shows 5 projects + 5 proposals + 8 votes + activity. Admin shows stat cards + 20-row user table + audit log. Both are very tall on mobile.
**Fix:** Add "Show more" / collapse for lists exceeding 3 items. Consider a tabbed layout for admin (Users tab, Activity tab).

---

## Priority Fix Plan

### P0 -- Broken (Prevents usage or looks broken)

| # | Issue | Page | Description | Fix |
|---|-------|------|-------------|-----|
| 1 | 404 light-mode shows login page | 404 page | Screenshots 17-18 show login page. No light-mode 404 screenshot exists because the route redirects unauthenticated users. | Move 404 capture to the authenticated section of the test, OR exempt the 404 route from auth redirect. |

### P1 -- Major UX Problems

| # | Issue | Page | Description | Fix |
|---|-------|------|-------------|-----|
| 1 | Duplicate form + discussion sections | Project Detail | A second "Project Discussion" and "New Proposal" form appear below the fold on all viewports. Desktop shows sidebar form AND bottom form simultaneously. | Remove the bottom-of-page duplicate sections. Show sidebar form on desktop only, dialog on mobile only. Render discussion section once inside the project card. |
| 2 | Admin mobile illegibility | Admin Panel | User emails truncated to unreadable fragments. Audit log is dense and tiny on mobile. | Use responsive card layout for mobile admin. Show email prominently, role as badge, hide Name when empty. Add "Show more" to audit log. |

### P2 -- Polish (Should fix soon)

| # | Issue | Page | Fix |
|---|-------|------|-----|
| 1 | Mobile navbar tap targets | All pages | Increase spacing between icons or consolidate into menu |
| 2 | Admin search filters wrong element | Admin Panel | Wire the "Search users..." input to filter the user table, not trigger global nav search |
| 3 | Dashboard page length on mobile | Dashboard | Limit visible items to 3 per section with "Show more" links |
| 4 | Forgot-password card vertical position (mobile) | Forgot Password | Center the card vertically or position higher on mobile |
| 5 | Proposal author truncation lacks tooltip | Project Detail | Add `title` attribute with full author name/email to truncated text |
| 6 | Change-password tab not captured in test | Profile | Update test to click "Security" tab and capture the change password form |
| 7 | AI modal content bleed-through | Project Detail | Increase overlay opacity or use a solid backdrop |
| 8 | "Submit Proposal" button detached from form | Project Detail sidebar | Move button closer to the form fields or make it full-width |
| 9 | Audit log timestamp inconsistency | Admin Panel | Standardize on relative timestamps ("2h ago") throughout |
| 10 | Dashboard "Recent Votes" lacks project context | Dashboard | Add project name below each voted proposal |
| 11 | Register form vertical rhythm | Register | Equalize spacing between all form fields |

### P3 -- Nice-to-Have

| # | Issue | Page | Fix |
|---|-------|------|-----|
| 1 | Light-mode buttons use black instead of brand green | Auth pages, Profile | Consider using green fill for primary CTAs in light mode too |
| 2 | Home feature cards subtle borders (light mode) | Home | Add slightly more shadow/border definition to cards |
| 3 | Password strength indicator | Register | Add visual strength bar below password field |
| 4 | Mobile stat chip label readability | Dashboard | Slightly increase font size or spacing for stat labels |
| 5 | Native date picker | Create Project | Consider custom date picker for cross-browser consistency |
| 6 | "Cancel" button weight | Create Project | Give Cancel slightly more visual presence (outline style) |
| 7 | 404 description text brightness (dark mode) | 404 page | Use slightly brighter text color for the description |

---

## Summary

### Overall Assessment

The application has improved meaningfully since v1. The most impactful fixes are:

1. **Dark mode button visibility** -- Auth page buttons are now green and clearly visible (was the biggest visual defect in v1)
2. **Profile page tabs** -- Transformed from an endlessly scrolling page into a clean tabbed interface with avatar
3. **Delete button moved to overflow menu** -- No longer a prominent red button competing with safe actions
4. **Pagination context** -- "Showing X-Y of Z" text added
5. **Feature card centering** -- Bottom row centered on home page
6. **Human-readable countdowns** -- "30 days left" instead of precise seconds

### Remaining Top 3 Priorities

1. **Fix the duplicate form/discussion on project detail** (P1-1) -- This is the single biggest remaining UX issue. Every viewport shows redundant sections below the fold.
2. **Fix 404 light-mode capture** (P0-1) -- Either a test fix or a route-level fix to allow unauthenticated 404 pages.
3. **Admin mobile readability** (P1-2) -- The admin panel is barely usable on mobile devices.

### Effort Estimates

- P0 fix: ~15 min (move 404 capture in test, or fix route guard)
- P1 fixes: ~3-4 hours (remove duplicate sections, admin mobile responsive)
- P2 fixes: ~3-4 hours (incremental polish tasks)
- P3 fixes: ~1-2 hours (when time permits)

### Sprint 32 Impact

Based on commit messages, Sprint 32 addressed many v1 issues:
- Profile avatar (Goal 8)
- Human countdown (Goal 8)
- Stat card links (Goal 8)
- Comment tooltip (Goal 8)
- Centered feature cards (Goal 7)
- Project card min-height (Goal 7)
- Pagination "X-Y of Z" (Goal 7)
- Vote bar ratio (Goal 6)
- AI modal skeleton (Goal 6)
- Button spacing (Goal 6)
- Dark card border (Goal 6)
- Text truncation + title tooltips (Goal 5)
- Forgot-password branding (Goal 5)

This is solid progress -- 13 of ~20 v1 issues addressed in a single sprint.
