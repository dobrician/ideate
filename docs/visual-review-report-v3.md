# Visual Review Report v3 — Full Screenshot Analysis

**Date:** 2026-02-18
**Screenshots analyzed:** 104 (13 pages × locale × theme × viewport)
**Data:** Both test seed data and real production data

---

## Critical / High Priority Issues

### 1. Primary button color inconsistent between themes
- **Light mode:** Primary buttons are black/dark
- **Dark mode:** Primary buttons are green
- **Affects:** ALL pages — Login, Register, Profile, New Project, 404, etc.
- **Fix:** Use green (brand accent) consistently in both themes

### 2. Proposal title text overflow on mobile
- **Where:** Project detail page, proposal cards
- **Issue:** Long titles like "Escapadă la Rezervația de Zimbri de la Sic (Sighișoara)" get truncated/clipped
- **Fix:** Use `line-clamp-2` with proper wrapping, ensure container doesn't clip

### 3. Theme toggle and language selector missing on mobile
- **Where:** All mobile pages
- **Issue:** No way to switch theme or language on mobile — these controls only appear on desktop navbar
- **Fix:** Add to hamburger menu or user profile dropdown

### 4. "1 votes" / "1 proposals" grammar errors
- **Where:** Dashboard, Projects list, project cards
- **Issue:** Plural form used for singular values throughout
- **Fix:** Implement proper i18n pluralization rules

### 5. Profile tab bar clipped on mobile
- **Where:** Profile page
- **Issue:** "Account | Security | Notifications | My Projects | My Proposals" tabs overflow — first and last tabs are cut off with no scroll indicator
- **Fix:** Horizontal scroll with fade indicators, or dropdown for tabs on mobile

### 6. Desktop sidebar "New Proposal" form clips content
- **Where:** Project detail page, desktop
- **Issue:** "Preview" tab truncated to "Previe...", markdown hint text clipped, submit button extends to viewport edge
- **Fix:** Ensure sidebar has proper width constraints and content wraps

### 7. Admin table unusable on mobile
- **Where:** Admin panel
- **Issue:** User and Project tables have horizontal overflow, email addresses truncated to unreadable
- **Fix:** Switch to card-based layout on mobile, or horizontal scroll with proper indicators

### 8. Vote bar gradient still too aggressive on proposal cards
- **Where:** Project detail, proposal cards
- **Issue:** Green gradient fills entire title area making it look like a highlighter
- **Fix:** Make gradient more subtle or use a thin bar below the title

---

## Medium Priority Issues

### 9. Input field borders inconsistent between themes
- Login/Register: Email field has visible border, Password field appears borderless
- Light mode borders are too faint

### 10. "Forgot password?" link not visually distinguished in light mode
- Appears as plain gray text, no underline or color differentiation

### 11. Dashboard charts unreadable on mobile
- "Top Proposals" y-axis labels truncated/overlapping
- "Votes Over Time" legend low contrast in dark mode
- Activity chart x-axis labels cramped

### 12. "project(s)" developer-style pluralization
- "38 project(s) total" instead of "38 projects total"

### 13. Dashboard stat cards blend into background in dark mode
- Card borders barely perceptible, cards don't stand out

### 14. "View all" truncated to "View" on mobile dashboard
- Text clipped by container width

### 15. Mobile card padding too tight
- Login, Register, Forgot Password cards have ~8-10px side margins
- Feels cramped on mobile

### 16. "29 days left" badge uses red — implies false urgency
- Red typically means danger/error; 29 days isn't urgent
- Should use neutral color, reserve red for <3 days

### 17. Comment input area has excessive empty space
- Large gap between "No comments yet" and comment input

### 18. Romanian translations cause layout overflow
- "Previzualizare" truncated in sidebar tabs
- "Depune Propunerea" extends beyond container
- "Cele mai populare" dropdown wider than "Most popular"

### 19. Date format hardcoded to US format (mm/dd/yyyy)
- Should respect locale (dd/mm/yyyy for Romanian)

### 20. Search dialog — no visible results, empty state unclear
- (Based on search-dialog screenshots with test data)

---

## Low Priority / Polish Issues

### 21. No hover/focus states on project cards
### 22. Pagination buttons too small on mobile (<44px touch targets)
### 23. "Details ↓" link on proposal cards has low discoverability
### 24. No character count on title/description fields
### 25. No breadcrumbs on inner pages
### 26. No loading skeletons visible
### 27. Empty states are minimal (no illustrations)
### 28. Checkbox column in admin has no bulk action bar
### 29. Webhook event checkboxes cramped on mobile
### 30. Profile avatar has no upload option
### 31. 404 card border barely visible in light mode
### 32. Charts lack accessible alternatives (screen reader)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical/High | 8 |
| Medium | 12 |
| Low/Polish | 12 |
| **Total** | **32** |
