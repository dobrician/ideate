# Visual Design Review Report

**Date:** February 17, 2026
**Reviewed by:** Claude (automated visual review)
**Screenshots:** 56 total (mobile + desktop, light + dark, all pages)
**Source:** `tests/visual-review/screenshots/resized/`

---

## Table of Contents

1. [Page-by-Page Findings](#page-by-page-findings)
2. [Cross-Cutting Issues](#cross-cutting-issues)
3. [Priority Fix Plan](#priority-fix-plan)

---

## Page-by-Page Findings

### 1. Home / Landing Page (01-04)

**Screenshots:** `01-home-mobile-light.png` through `04-home-desktop-dark.png`

**What's Good:**
- Clean hero section with clear value proposition and two CTAs ("Get Started" + "View Projects")
- Feature cards are well-structured with icons, bold titles, and descriptions
- Desktop layout uses a 3+2 grid for feature cards; mobile stacks them vertically -- both work well
- Dark mode has good contrast and the cards have visible borders against the dark background
- Navigation bar is clean with search, language selector, theme toggle, and user icon

**Issues:**
- **[P2]** Mobile nav bar icons (search, globe, theme, user) are tightly packed with minimal spacing -- on small screens they could be hard to tap accurately
- **[P3]** The "Ideate" logo text in the navbar uses a colored/gradient style that could be slightly bolder for brand presence
- **[P3]** Desktop light mode: the feature cards have very subtle borders/shadows -- they could benefit from slightly more definition to separate them from the white background
- **[P3]** The bottom row of feature cards (Discussions, Dashboard) is left-aligned on desktop leaving an empty third column -- centering these two cards would look more balanced

---

### 2. Login Page (05-10)

**Screenshots:** `05-login-empty-mobile-light.png` through `10-login-mobile-dark.png`

**What's Good:**
- Centered card layout works well on both mobile and desktop
- Clear hierarchy: brand name, page title, subtitle, form fields, primary CTA, divider, secondary CTA
- Validation states (07, 08) show red border + red text below fields -- clear and standard
- "Forgot password?" link is well-placed next to the Password label
- OR divider between password login and magic link is clean
- Dark mode card has visible borders and good contrast

**Issues:**
- **[P1]** Dark mode: the "Sign In with Password" button uses a dark fill that blends with the dark card background -- the button border is barely visible. Need more contrast between button and card bg
- **[P2]** Dark mode: "Sign in with Magic Link" outline button border is very faint against the dark card
- **[P2]** The "Ideate" brand text at the top of the auth card appears to use a gradient/colored style but is quite small and understated for a brand moment
- **[P3]** Desktop card could be slightly wider (currently feels narrow for the amount of whitespace around it)

---

### 3. Register Page (11-14, 53-54)

**Screenshots:** `11-register-empty-mobile-light.png` through `54-register-mobile-dark.png`

**What's Good:**
- Consistent card style with the login page
- Password requirements hint ("Min 8 characters with uppercase, lowercase, and number") is visible below the password field
- Validation state shows all three fields with red borders and error messages
- Clean layout on both mobile and desktop

**Issues:**
- **[P1]** Dark mode: same button contrast issue as login -- "Create Account" button is nearly invisible against dark card background
- **[P2]** Desktop register form (12) appears more compact/cramped than the login form -- the spacing between Password and Confirm Password fields is tight
- **[P3]** No password strength indicator -- just a static text hint. A progress bar would improve UX

---

### 4. Forgot Password Page (15-16, 51-52)

**Screenshots:** `15-forgot-password-mobile-light.png` through `52-forgot-password-mobile-dark.png`

**What's Good:**
- Minimal, focused form -- just email + submit + back link
- Card layout is consistent with other auth pages
- "Back to Sign In" link is clearly visible

**Issues:**
- **[P1]** Dark mode: "Send Reset Link" button has the same contrast problem -- dark button on dark card
- **[P2]** Mobile light mode (15): the card is pushed down leaving significant empty space above -- the card should be vertically centered or at least higher up
- **[P2]** No "Ideate" branding on this page (unlike login/register) -- inconsistent with sibling auth pages

---

### 5. 404 Page (17-18, 55-56)

**Screenshots:** `17-404-mobile-light.png`, `18-404-desktop-light.png`, `55-404-desktop-dark.png`, `56-404-mobile-dark.png`

**CRITICAL NOTE:** Screenshots 17 and 18 (labeled as 404) actually show the **login page**, not a 404 page. The actual 404 page is captured in screenshots 55 and 56 (dark mode only).

**What's Good (55-56, actual 404):**
- Large "404" text is bold and immediately communicable
- Descriptive subtitle: "The page you're looking for doesn't exist or has been moved."
- Two action buttons: "Go Home" and "View Projects" -- good recovery options
- Navbar is visible so users can navigate away

**Issues:**
- **[P0]** Screenshots 17-18 are **mislabeled or miscaptured** -- they show the login page instead of a 404 page in light mode. This means we have no light-mode 404 screenshots. The test setup needs fixing.
- **[P2]** 404 dark mode: the card has visible borders but the "404" text and description could use slightly more contrast (appears grayish)
- **[P3]** The 404 buttons use outline style -- a primary filled button for "Go Home" would make the preferred action clearer

---

### 6. Dashboard (19-22)

**Screenshots:** `19-dashboard-mobile-light.png` through `22-dashboard-desktop-dark.png`

**What's Good:**
- Strong information hierarchy: stat cards at top, then project list, proposals, votes, and activity
- Desktop uses a 4-column stat card row (My Projects, My Proposals, My Votes, My Comments) with clean card layout
- Mobile stacks the stat cards as horizontal scrollable chips -- works well
- "New Project" and "Browse Projects" CTAs are prominent
- Project list shows project name, stats (proposals, votes, comments), deadline badge ("30d left"), and status badge ("Active")
- Dark mode has good contrast overall -- cards are distinct from background

**Issues:**
- **[P1]** Dashboard content uses test data with long numeric IDs (e.g., "E2E Test Project 1771268142172") which makes it hard to evaluate real-world truncation behavior, but the names appear to fit without overflow
- **[P1]** "Your Recent Votes" section shows only "Initial Test Proposal" repeated 8 times with colored vote icons -- there's no proposal differentiation or project context. In production this section would be confusing if multiple proposals share similar names
- **[P2]** Mobile (19): stat cards row ("My Projects", "My Proposals", etc.) is very compact -- the labels are small and could be hard to read
- **[P2]** "Recent Activity" section at bottom shows only one comment entry -- the empty state feels abrupt. Would benefit from a "View all activity" link
- **[P2]** Desktop (20): "Your Proposals" section lists proposals without project name context (shows "in E2E Test Project 177..." which is truncated). The full project name should be visible or truncated with ellipsis + tooltip
- **[P3]** The "View all" link on "Your Projects" section is right-aligned and small -- could be more discoverable

---

### 7. Projects List (23-25)

**Screenshots:** `23-projects-list-mobile-light.png` through `25-projects-list-desktop-dark.png`

**What's Good:**
- Desktop uses a responsive card grid (3 columns) with pagination
- Each project card shows: name, status badge ("Active"), description preview, deadline, creation date
- Search bar and filter controls (status dropdown, sort) are present
- Pagination component is clean with numbered pages and arrows
- Mobile stacks cards vertically -- clean single-column layout
- "Create Project" button is prominent (green, top-right on desktop)
- Dark mode cards have visible borders and good readability

**Issues:**
- **[P1]** Mobile (23): the "Create Project" button label shows as just "Create Project" in full but appears to have been cut in certain widths. The button + search bar take significant vertical space
- **[P2]** Project card descriptions are truncated but the cards themselves don't have consistent heights on desktop -- some cards appear shorter than others in the grid, creating uneven rows
- **[P2]** Mobile (23): project names with long numeric IDs (E2E test data) cause the title to wrap to 2-3 lines -- in production, long project names could push card content down significantly
- **[P2]** The "All statuses" filter dropdown appears small and could be overlooked
- **[P3]** Desktop pagination could show "Showing 1-12 of 32 projects" for context

---

### 8. Create Project (26-28, 50)

**Screenshots:** `26-create-project-mobile-light.png` through `50-create-project-desktop-dark.png`

**What's Good:**
- Clean form layout with labeled fields: Project Title, Description (textarea), Deadline (date picker), Status (dropdown)
- Required fields marked with red asterisks
- Helpful hint text below fields ("A clear, descriptive title", "Optional: Provide context", etc.)
- Validation state (28) shows red borders and error messages correctly
- Two clear actions: "Create Project" (primary) and "Cancel" (secondary)
- Dark mode form looks good with visible field borders

**Issues:**
- **[P2]** Dark mode (50): the form card doesn't have a visible border/distinction from the page background -- it blends into the dark background
- **[P2]** The "Cancel" button is styled as plain text/link next to the filled "Create Project" button. This is fine but the positioning could be confusing -- "Cancel" should be left-aligned or have more visual separation
- **[P3]** Date picker uses native `mm/dd/yyyy` format -- consider a custom date picker for consistency across browsers

---

### 9. Project Detail (29-34)

**Screenshots:** `29-project-detail-mobile-light.png` through `34-proposal-expanded-mobile-light.png`

**What's Good:**
- Clear page structure: back navigation, action buttons (PDF, CSV, Edit, Delete), project info, proposals list, discussion section
- Status badge ("Active") + countdown timer ("29d 23:59:30 remaining") are prominent and informative
- Proposal row shows: title, author (truncated), vote bar with green fill, vote counts (thumbs up, thumbs down, comments)
- Expanded proposal (33-34) reveals description preview, "Show full description" link, date, and Delete button
- "New Proposal" sidebar form on desktop is well-positioned and contains Title, Description, and Pro/Contra vote toggle
- Comment section with "Add a comment..." input and send button is clean
- AI Suggestions button is visible next to the proposals heading

**Issues:**
- **[P1]** Desktop (30): the "New Proposal" sidebar form appears below the fold AND duplicated -- there's a sidebar form on the right AND a full-width form at the bottom of the page. Users see both simultaneously which is confusing
- **[P1]** Mobile (29): the "+ New" button is partially cut off at the right edge of the screen -- it shows "+ New" but the label may be truncated. The button appears to overflow on narrow screens
- **[P1]** The "Delete" button (red, top of page) is too prominent and sits next to non-destructive actions (PDF, CSV, Edit). Destructive actions should be visually separated or behind a "More" menu
- **[P2]** Mobile (29): action buttons (PDF, CSV, Edit) are left-aligned under "Back to Projects" with the Delete button on a separate line below -- the layout feels scattered
- **[P2]** Proposal row: the author email ("by e2e-test@ideate.local") is truncated with no tooltip or ellipsis visible in some views
- **[P2]** The vote bar (green gradient fill) shows "1" thumbs up but the bar fills about 60% -- the fill ratio doesn't match the vote count (1 pro, 0 contra should be 100% green)
- **[P2]** "Project Discussion (0)" section has an empty state ("No comments yet. Start the discussion!") which is decent but the icon is very small
- **[P3]** The countdown timer "29d 23:59:30" is precise to the second -- a simpler "30 days left" would be cleaner for most contexts

---

### 10. AI Suggestions Modal (35-36)

**Screenshots:** `35-ai-suggestions-modal-desktop-light.png`, `36-ai-suggestions-modal-mobile-light.png`

**What's Good:**
- Modal overlay dims the background appropriately
- Clear title "AI Suggestions" with subtitle "AI-generated proposal ideas for this project"
- Loading state shows a spinner with "Generating suggestions..." text
- Close button (X) is visible in the top-right corner

**Issues:**
- **[P2]** The modal is quite small/minimal on desktop (35) -- with only a loading spinner it looks empty. The modal could be slightly larger or have more visual interest during loading
- **[P2]** Mobile (36): the modal appears to overlap with the page content behind it and the background dimming is inconsistent -- some text from behind bleeds through
- **[P3]** No loading skeleton or progress indication beyond the spinner -- a pulsing skeleton of "suggestion cards" would feel more polished

---

### 11. New Proposal Dialog - Mobile (37)

**Screenshot:** `37-new-proposal-dialog-mobile-light.png`

**What's Good:**
- Clean modal dialog with Title input, Description textarea, and Pro/Contra vote toggle
- "Pro" button is filled green when selected -- clear visual feedback
- Cancel and Submit Proposal buttons are well-sized and accessible
- Close button (X) in top-right corner

**Issues:**
- **[P2]** The dialog partially obscures the page content behind it but some elements (like "PDF", "CSV" buttons and project details) are still visible and distracting
- **[P3]** The Pro/Contra toggle could use icons that are more distinct -- the current thumbs-up/thumbs-down icons are small

---

### 12. Proposal Sidebar Form - Desktop (38)

**Screenshot:** `38-proposal-sidebar-form-desktop-light.png`

**What's Good:**
- Sidebar placement keeps users in context with the project detail page
- Form fields are clear and well-labeled

**Issues:**
- **[P1]** This screenshot is visually identical to #33 (proposal-expanded-desktop-light) -- the sidebar form and the bottom full-width form are both visible simultaneously, which is the duplicate form issue noted in Project Detail
- **[P2]** "Submit Proposal" button is pushed to the bottom-right and looks disconnected from the form

---

### 13. Comments Section - Desktop (39)

**Screenshot:** `39-comments-section-desktop-light.png`

**What's Good:**
- Comment input field with paper-plane send icon is standard and recognizable
- The section is part of the project detail page flow

**Issues:**
- **[P2]** Screenshot appears identical to the expanded proposal view. The comments section itself is minimal -- just an input field with an empty state. With actual comments, spacing and threading would need review
- **[P3]** The send button (paper plane icon) could have a hover tooltip for accessibility

---

### 14. Profile Page (40-41, 48-49)

**Screenshots:** `40-profile-mobile-light.png` through `49-profile-mobile-dark.png`

**What's Good:**
- Well-organized sections: Account info, Edit Profile, Change Password, Your Projects, Your Proposals
- Account info displays Email, Role, Member Since, Display Name in a clean grid
- Edit Profile form has First Name and Last Name side by side on desktop
- "Your Projects (10)" and "Your Proposals (10)" lists show items with status badges
- Dark mode is well-implemented with clear text and border contrast

**Issues:**
- **[P1]** The profile page is very long -- it combines account info, profile editing, password change, project list (10 items), and proposal list (10 items) all on one page with no tabs or accordion sections. This results in excessive scrolling
- **[P2]** Mobile (40): the page is extremely long due to stacked vertical content. Project names are truncated with "..." which is correct, but the list goes on for 10+ items without a "Show more" / collapse mechanism
- **[P2]** "Change Password" section has no visible field borders in the light mode screenshot (41) -- the Current Password, New Password, and Confirm fields appear as plain lines (underline style) which is inconsistent with the Edit Profile fields above that use bordered inputs
- **[P2]** "Your Projects" list shows project names truncated to "E2E Test Project 177..." with "Active" badges aligned right -- the truncation point varies and looks ragged
- **[P3]** No avatar/profile picture section -- users might expect one on a profile page
- **[P3]** The "Save Changes" and "Change Password" buttons both use dark filled style -- having two equally prominent CTAs is confusing. One should be secondary

---

### 15. Change Password - Desktop (42-43)

**Screenshots:** `42-change-password-desktop-light.png`, `43-change-password-mobile-light.png`

These appear to show the same profile page (the change password section is embedded in the profile page, not a separate page). See Profile findings above.

---

### 16. Admin Panel (44-47)

**Screenshots:** `44-admin-mobile-light.png` through `47-admin-search-desktop-light.png`

**What's Good:**
- Clean stat cards at top: Users (64), Projects (32), Proposals (43), Votes (45)
- User management table with columns: Email, Name, Role, Joined
- Role displayed with dropdown-style selector for quick editing
- Search functionality (47) with filtering
- Pagination: "1-20 of 64 users"
- Recent Activity / Audit log section at bottom with event type, user, and timestamp
- Dark mode (46) has excellent contrast -- table rows are clearly separated

**Issues:**
- **[P1]** Mobile (44): the admin page is extremely long and the user table becomes a vertically stacked card format. Email addresses and names are truncated aggressively -- many show as "smokepass07710..." which is unreadable
- **[P1]** Mobile (44): the "Name" column shows em-dashes ("--") for most users since they haven't set names. This wastes space and looks broken -- consider hiding the Name column on mobile or showing "No name" in lighter text
- **[P2]** Desktop (45): table rows where Name is "--" look incomplete. Consider showing "Not set" in muted text instead
- **[P2]** Admin search (47): the search bar at the top shows "e2e" query with a "No results found" message BUT the table below still shows all users. The search appears to filter the global search bar (nav), not the user table -- this is confusing UX
- **[P2]** The "Recent Activity" / audit log section (bottom of admin page) has dense, small text. Entries show type badges ("session", "user", "vote") but timestamps are in full datetime format which makes scanning difficult
- **[P2]** Mobile audit log entries are barely readable -- event descriptions are truncated to near-illegibility
- **[P3]** Stat cards could link to filtered views (clicking "Users: 64" could navigate to the user list)
- **[P3]** Role dropdown in the table could use clearer affordance that it's editable (currently looks like plain text with a small chevron)

---

## Cross-Cutting Issues

These patterns repeat across multiple pages:

### CC-1: Dark Mode Button Contrast (P1)
**Affects:** Login, Register, Forgot Password, and any page with primary dark-filled buttons on dark cards
**Problem:** Primary action buttons (e.g., "Sign In with Password", "Create Account", "Send Reset Link") use a dark fill color that becomes nearly invisible against the dark card/page background in dark mode. The button text is readable but the button boundaries are lost.
**Fix:** Use the brand color (green/teal from the "Get Started" button) for primary CTAs in dark mode, or add a visible border/glow to dark buttons on dark backgrounds.
**Files:** Auth form components, likely `src/components/ui/button.tsx` or global theme CSS.

### CC-2: Mobile Navigation Density (P2)
**Affects:** All pages with navbar
**Problem:** The mobile navbar packs 5 elements (logo, search icon, globe/language, theme toggle, user icon) into a narrow space. Tap targets may be too small (< 44px recommended by Apple/Google).
**Fix:** Consider grouping language + theme into a settings menu, or reducing icon count on mobile.
**Files:** Navbar component, likely `src/components/navbar.tsx` or `src/components/header.tsx`.

### CC-3: Test Data Obscuring Real UX (P2)
**Affects:** Dashboard, Projects List, Admin, Profile
**Problem:** Test data uses long numeric identifiers ("E2E Test Project 1771268142172") which don't represent real usage. Some truncation issues may or may not exist with real data. However, the E2E screenshots expose that truncation with `text-overflow: ellipsis` is used inconsistently.
**Recommendation:** Add `max-width` + `text-overflow: ellipsis` + `overflow: hidden` consistently to all project/proposal name displays. Also consider adding `title` attributes for tooltip on hover.

### CC-4: Form Field Styling Inconsistency (P2)
**Affects:** Profile page (Change Password vs Edit Profile sections), Create Project
**Problem:** Some form inputs use bordered box style (e.g., login fields, project title) while others use underline-only style (e.g., Change Password fields on profile page). This inconsistency undermines visual cohesion.
**Fix:** Standardize all form inputs to use the same border/box style.
**Files:** Check `src/components/ui/input.tsx` and individual page forms.

### CC-5: Auth Page Branding Inconsistency (P2)
**Affects:** Login, Register, Forgot Password
**Problem:** Login and Register pages show the "Ideate" brand name at top of the card. Forgot Password page does not. This is a small inconsistency.
**Fix:** Add "Ideate" brand text to the forgot-password card header.

### CC-6: Long Page Syndrome (P2)
**Affects:** Profile, Admin, Dashboard
**Problem:** Several pages combine too much content vertically without pagination, tabs, or collapse controls. Profile page especially is very long on mobile (account info + edit form + password change + 10 projects + 10 proposals).
**Fix:** Use tabs or accordion sections on Profile. Add "Show more" / "View all" with a default limit of 3-5 items for lists.

### CC-7: Destructive Action Placement (P2)
**Affects:** Project Detail
**Problem:** The red "Delete" button sits alongside non-destructive actions (PDF, CSV, Edit) at the same visual hierarchy level. Accidental deletion is a risk.
**Fix:** Move Delete behind a "..." more menu, or place it at the bottom of the page separated from primary actions.

---

## Priority Fix Plan

### P0 -- Broken (Prevents usage or looks broken)

| # | Issue | Page | Description | Suggested Fix |
|---|-------|------|-------------|---------------|
| 1 | Mislabeled 404 screenshots | 404 page | Screenshots 17-18 show login page, not 404. No light-mode 404 screenshot exists. | Fix the E2E test that captures 404 page in light mode. Check if the 404 route redirects to login for unauthenticated users -- if so, capture 404 as authenticated user. |

### P1 -- Ugly (Unprofessional appearance)

| # | Issue | Page | Description | Suggested Fix |
|---|-------|------|-------------|---------------|
| 1 | Dark mode button invisibility | Login, Register, Forgot Password | Primary CTA buttons (dark fill) are nearly invisible against dark card backgrounds | Change primary button variant in dark mode to use brand color (green) fill or add `border: 1px solid` with a lighter color. File: `src/components/ui/button.tsx` or Tailwind theme config |
| 2 | Duplicate proposal form | Project Detail (desktop) | Sidebar form AND bottom full-width form both visible simultaneously | Show only the sidebar form on desktop. Hide the bottom form when sidebar is visible. Use CSS `@media` or component logic. Files: `src/app/projects/[id]/page.tsx`, proposal form component |
| 3 | Mobile "+ New" button overflow | Project Detail (mobile) | The "+ New Proposal" button is clipped at the right edge on narrow screens | Ensure the proposals header row uses `flex-wrap` or reduce button label to just "+" icon on very narrow screens. File: proposal list component |
| 4 | Delete button too prominent | Project Detail | Red Delete button sits next to PDF/CSV/Edit with equal visual weight | Move Delete to an overflow menu ("...") or separate it visually with a divider. File: `src/app/projects/[id]/page.tsx` |
| 5 | Admin mobile table illegibility | Admin Panel (mobile) | User emails and audit log entries are truncated to unreadable fragments | Use a responsive card layout for mobile that shows Email prominently, Role as a badge, and hides Name when empty. File: `src/app/admin/page.tsx` |
| 6 | Profile page length | Profile | Page is excessively long combining 5 distinct sections without tabs or collapse | Split into tabbed sections (Account, Security, My Projects, My Proposals) or add collapse/expand with "Show more" links. File: `src/app/profile/page.tsx` |

### P2 -- Polish (Could be improved)

| # | Issue | Page | Suggested Fix |
|---|-------|------|---------------|
| 1 | Mobile navbar tap targets | All pages | Increase spacing between icons to ensure 44px minimum tap targets |
| 2 | Auth page branding gap | Forgot Password | Add "Ideate" brand text to forgot-password card header |
| 3 | Form field style inconsistency | Profile | Standardize all inputs to bordered box style, not underline |
| 4 | Text truncation inconsistency | Dashboard, Profile, Admin | Apply consistent `truncate` / `text-overflow: ellipsis` + `title` attributes |
| 5 | Project card height variance | Projects List (desktop) | Set `min-height` on project cards or use CSS Grid `auto-fill` with equal row heights |
| 6 | Vote bar fill ratio | Project Detail | Vote bar fill percentage should match actual pro/(pro+contra) ratio |
| 7 | Admin search UX confusion | Admin Panel | Ensure the user table search filters the table, not the global nav search |
| 8 | Forgot password vertical centering | Forgot Password (mobile) | Center the card vertically instead of pushing it to lower half |
| 9 | AI suggestions modal size | Project Detail | Make the modal slightly larger on desktop; add skeleton loading state |
| 10 | "Submit Proposal" button detached | Project Detail (desktop sidebar) | Move the submit button closer to the form fields in the sidebar |
| 11 | Admin "Name" column empty states | Admin Panel | Show "Not set" in muted text instead of "--" em-dashes |
| 12 | Dark mode outline buttons | Login | Increase border opacity/brightness for secondary buttons in dark mode |
| 13 | Dark mode create-project card | Create Project | Add subtle border to the form card in dark mode for definition |
| 14 | Audit log readability | Admin Panel | Use relative timestamps ("2h ago"), truncate descriptions with expand |

### P3 -- Nice-to-Have (Aesthetic preferences)

| # | Issue | Page | Suggested Fix |
|---|-------|------|---------------|
| 1 | Home feature cards centering | Home (desktop) | Center the bottom row of 2 cards instead of left-aligning |
| 2 | Desktop auth card width | Login, Register | Make the card slightly wider (e.g., `max-w-md` to `max-w-lg`) |
| 3 | Password strength indicator | Register | Add a visual strength bar below the password field |
| 4 | 404 button hierarchy | 404 page | Make "Go Home" a filled primary button, "View Projects" as outline |
| 5 | Profile avatar placeholder | Profile | Add an avatar/initials circle to the Account section |
| 6 | Countdown timer precision | Project Detail | Show "30 days left" instead of "29d 23:59:30 remaining" |
| 7 | Dashboard "View all" discoverability | Dashboard | Make "View all" links more prominent or use a consistent pattern |
| 8 | Pagination context | Projects List | Add "Showing 1-12 of 32 projects" text near pagination |
| 9 | Native date picker | Create Project | Consider a custom date picker for cross-browser consistency |
| 10 | Comment send button tooltip | Project Detail | Add `title="Send comment"` to the paper-plane icon button |
| 11 | Admin stat cards clickable | Admin Panel | Make stat cards link to filtered views (Users -> user list) |
| 12 | Pro/Contra toggle icon size | New Proposal dialog | Make thumbs-up/down icons slightly larger for clarity |

---

## Summary

**Overall Assessment:** The application has a solid foundation with clean layouts, consistent use of cards and whitespace, and good mobile responsiveness. The shadcn/ui component library provides a professional baseline. Dark mode is functional but needs contrast work on primary buttons. The biggest UX issues are the duplicate proposal form on desktop, the excessively long profile page, and the dark-mode button visibility problem.

**Top 3 Fixes for Maximum Impact:**
1. Fix dark mode primary button contrast across all auth pages (CC-1)
2. Resolve the duplicate proposal form on desktop project detail (P1-2)
3. Add tabs or collapse sections to the profile page (P1-6)

**Estimated Effort:**
- P0 fix: ~15 min (fix E2E test screenshot capture)
- P1 fixes: ~4-6 hours total (button theming, form dedup, mobile overflow, admin responsive, profile tabs)
- P2 fixes: ~3-4 hours total (incremental polish tasks)
- P3 fixes: ~2-3 hours total (when time permits)
