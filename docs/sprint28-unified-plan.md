# Sprint 28 — Final Mobile Polish (Unified Plan)

**Issue:** #49
**Date:** 2026-02-17
**Sources:** `sprint28-analysis-claude.md` (page-by-page audit), `sprint28-analysis-codex.md` (live staging + overflow audit)

---

## Goal 1: Admin table mobile fix

The admin user table is the only P0 item. Long emails blow out the table width on mobile, causing horizontal scroll even though `overflow-x-auto` exists on the container.

**Files:**
- `src/app/admin/user-role-manager.tsx:74` — add `max-w-[150px] truncate` to email `<td>`
- `src/app/admin/user-role-manager.tsx:89` — role `<select>` uses `text-xs py-1`, change to `text-base md:text-xs` to prevent iOS auto-zoom, bump padding for 44px touch target

---

## Goal 2: Fix all `<select>` elements for iOS auto-zoom

Every `<select>` in the app uses `text-sm` or `text-xs` without the `text-base` mobile override that `<Input>` and `<Textarea>` already have. iOS Safari auto-zooms on focus when font-size is below 16px.

**Files:**
- `src/app/projects/new/page.tsx:114` — status select: add `text-base md:text-sm`
- `src/components/edit-project-dialog.tsx:133` — status select: add `text-base md:text-sm`
- `src/app/admin/user-role-manager.tsx:89` — role select: (covered in Goal 1)

---

## Goal 3: Header & navigation touch targets

All header icon buttons are `size="icon"` (36px) and mobile nav links are ~30px. Both reports flag this as P1. The combined sticky header height (~96px, 14% of iPhone SE viewport) is noted but not addressed here — keep the dual-row layout, just fix tap sizes.

**Files:**
- `src/components/header.tsx:86` — search toggle: add `min-h-[44px] min-w-[44px]`
- `src/components/header.tsx:98` — user menu trigger: add `min-h-[44px] min-w-[44px]`
- `src/components/header.tsx:148` — mobile nav links: change `py-1.5` to `py-2.5` or add `min-h-[44px]`
- `src/components/dark-mode-toggle.tsx:67` — add `min-h-[44px] min-w-[44px]`
- `src/components/locale-switcher.tsx:46` — add `min-h-[44px] min-w-[44px]`

---

## Goal 4: Fix undersized action buttons (pagination, export, delete, misc)

Buttons in common touch flows are 24-32px tall, well under the 44px WCAG 2.5.5 minimum.

**Files:**
- `src/components/pagination.tsx:41,62,78` — prev/next/page buttons `h-8 w-8` to `h-11 w-11` (or `min-h-[44px] min-w-[44px]`)
- `src/components/export-buttons.tsx:29` — PDF/CSV `size="sm"` (32px): add `min-h-[44px]`
- `src/components/proposal-list.tsx:254` — delete proposal `h-6` (24px): add `min-h-[44px]` with appropriate padding
- `src/components/regenerate-summary-button.tsx:51` — `h-7`: add `min-h-[44px]`
- `src/components/pwa-install.tsx:69` — dismiss button (24px): increase to `min-h-[40px] min-w-[40px]`

---

## Goal 5: Form & dialog button touch targets

Submit/cancel buttons across forms and confirmation dialogs use `size="sm"` (32px) or default `h-9` (36px). Destructive delete confirmation buttons are especially important to size correctly.

**Files:**
- `src/components/proposal-form.tsx:111` — submit button: add `min-h-[44px]`
- `src/components/suggest-proposals.tsx:153` — trigger button: add `min-h-[44px]`
- `src/app/profile/profile-form.tsx:72` — save button: add `min-h-[44px]`
- `src/components/ui/dialog.tsx:72` — close (X) button (~24px): add explicit size `h-11 w-11`
- `src/components/ui/sheet.tsx:78` — close (X) button (~24px): add explicit size `h-11 w-11`

---

## Goal 6: Login page small touch targets

Two elements on the login page are ~18px — too small for any finger.

**Files:**
- `src/app/auth/login/page.tsx:183` — "Forgot password" link: add `py-2 inline-block`
- `src/app/auth/login/page.tsx:135` — "Dismiss" banner button: add `py-2 inline-block`
- `src/components/comment-thread.tsx:243` — "New messages" button (~30px): add `min-h-[44px]`

---

## Goal 7: Overflow protection for action rows & markdown

Codex audit found several multi-button rows that don't wrap on narrow screens, especially with long translated labels. Markdown content can also overflow horizontally with long unbroken tokens or code blocks.

**Files (action row wrapping):**
- `src/app/projects/new/page.tsx:133` — footer action row: add `flex-wrap` or stack on mobile
- Error page dual-button rows — add `flex-col sm:flex-row` pattern:
  - `src/app/admin/error.tsx:30`
  - `src/app/dashboard/error.tsx:32`
  - `src/app/profile/error.tsx:27`
  - `src/app/projects/error.tsx:35`
  - `src/app/auth/error.tsx:34`
  - `src/app/error.tsx:37`
  - `src/app/not-found.tsx:24`

**Files (markdown overflow):**
- `src/components/markdown-renderer.tsx:10` — add `overflow-wrap: anywhere` and horizontal scroll for code blocks

---

## Goal 8: Mobile nav overflow resilience

The mobile nav row is a single-row flex without wrap or scroll fallback. If nav items grow (e.g., admin link + longer translated labels), they can compress or overflow.

**Files:**
- `src/components/header.tsx:140` — mobile nav container: add `overflow-x-auto` or `flex-wrap` as a safety net
- `src/components/search-bar.tsx:57` — outside-click handler only listens to `mousedown`: add `touchstart` listener for mobile dismiss

---

## Goal 9: Playwright mobile device projects

The Playwright config has zero mobile device projects. Every existing mobile E2E test manually calls `setViewportSize()`, which resizes the viewport but does NOT enable touch event emulation, `deviceScaleFactor`, or mobile user agent. iOS-specific bugs like select auto-zoom cannot be caught.

**Files:**
- `playwright.config.ts:14-18` — add two mobile projects:
  ```ts
  { name: "Mobile Safari", use: { ...devices["iPhone 13"] } },
  { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ```

**New test coverage to add:**
- Admin page: table overflow behavior, select zoom, role changes on mobile
- Profile page: form layout, save button tap target
- Pagination: button sizing at mobile viewport
- Export buttons: tap target verification
- Sheet/dialog close buttons: sizing check

---

## Goal 10: Mobile E2E test cases

Write new Playwright tests that run under the mobile device projects from Goal 9. These validate that the fixes from Goals 1-8 actually work on mobile viewports with touch emulation.

**Test files to create/extend:**
- `tests/e2e/admin-mobile.test.ts` — admin table no-overflow, role select usable, email truncation
- `tests/e2e/mobile-touch-targets.test.ts` — header icons, nav links, pagination, export buttons all >= 44px
- `tests/e2e/mobile-overflow.test.ts` — error pages, project form footer, markdown blocks don't cause horizontal scroll

---

## Out of scope (deferred)

These items were noted by one or both reports but are not worth the risk in a final sprint:

| Item | Reason to skip |
|------|---------------|
| Collapse header to single row / hamburger | Structural change, high regression risk, current dual-row works |
| Raise base button primitive `h-9` to `h-11` globally | Blast radius too wide — would change desktop sizing everywhere |
| Raise base input primitive height globally | Same blast radius concern |
| Dialog base `max-h` constraint | Individual dialogs already set `max-h-[90vh]`; no reported bug |
| Password eye toggle `tabIndex={-1}` | Accessibility item, not mobile-specific, low priority |

---

## Checklist

- [ ] Goal 1: Admin table email truncation + select zoom fix
- [ ] Goal 2: All `<select>` elements get `text-base` mobile override
- [ ] Goal 3: Header & nav touch targets to 44px
- [ ] Goal 4: Pagination, export, delete, regen, PWA buttons to 44px
- [ ] Goal 5: Form submit/cancel & dialog/sheet close buttons to 44px
- [ ] Goal 6: Login page small links + "new messages" button
- [ ] Goal 7: Action row wrapping + markdown overflow protection
- [ ] Goal 8: Mobile nav overflow resilience + search touch dismiss
- [ ] Goal 9: Playwright mobile device projects (iPhone 13 + Pixel 5)
- [ ] Goal 10: New mobile E2E tests for admin, touch targets, overflow
