# Sprint 28 — Final Mobile Polish & Sweep Analysis

**Issue:** #49
**Date:** 2026-02-17
**Scope:** Exhaustive page-by-page mobile audit of every route, component, and flow

---

## 1. Routes Discovered

| Route | File | Mobile Status |
|-------|------|---------------|
| `/` | `src/app/page.tsx` | Good |
| `/dashboard` | `src/app/dashboard/page.tsx` | Good |
| `/projects` | `src/app/projects/page.tsx` | Good |
| `/projects/new` | `src/app/projects/new/page.tsx` | Issue (select) |
| `/projects/[id]` | `src/app/projects/[id]/page.tsx` | Issues (buttons) |
| `/projects/[id]/edit` | redirects to `/projects/[id]` | N/A |
| `/auth/login` | `src/app/auth/login/page.tsx` | Minor issues |
| `/auth/register` | `src/app/auth/register/page.tsx` | Good |
| `/auth/forgot-password` | `src/app/auth/forgot-password/page.tsx` | Good |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx` | Good |
| `/auth/verify-email` | `src/app/auth/verify-email/page.tsx` | Good |
| `/profile` | `src/app/profile/page.tsx` | Minor issues |
| `/admin` | `src/app/admin/page.tsx` | Major issues |
| 404 | `src/app/not-found.tsx` | Good |
| Error | `src/app/error.tsx` | Good |

---

## 2. Page-by-Page Mobile Audit

### `/` (Home) — No Issues

Fully responsive. `px-4 py-8 max-w-4xl mx-auto` gutters, `flex-col gap-3 sm:flex-row` CTAs stack on mobile, `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` feature cards go single-column.

### `/auth/login` — Two Minor Issues

- **P2:** "Forgot password" link at line 183 — `text-xs` with no padding, ~18px tap target
- **P2:** "Dismiss" banner button at line 135 — `text-xs text-green-600 underline`, ~18px tap target
- Inputs use `text-base md:text-sm` (correct iOS zoom prevention)
- All submit buttons `w-full` — correct

### `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` — No Issues

Same `w-full max-w-md px-4` layout pattern as login. All inputs use shared `Input` component with correct `text-base` mobile sizing.

### `/dashboard` — No Issues

Excellent mobile adaptation. Explicit `sm:hidden` compact stat pills for mobile vs `hidden sm:grid` desktop stat cards. `text-2xl sm:text-3xl` heading. `grid gap-6 lg:grid-cols-2` layout.

### `/projects` — No Issues

`flex-col gap-4 sm:flex-row` header stacks on mobile. `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` project cards go single-column. Entire card is wrapped in `<Link>` — whole card is the tap target.

### `/projects/new` — One Issue

- **P1:** `<select id="status">` at line 114 uses `text-sm` without `text-base` mobile override — triggers iOS auto-zoom when tapped
- Cancel button `variant="outline"` defaults to `h-9` (36px), marginal

### `/projects/[id]` — Two Issues

Complex page, well-handled overall. `lg:grid lg:grid-cols-[1.6fr_1fr]` responsive layout, mobile shows dialog trigger vs desktop sticky sidebar.

- **P1:** `ExportButtons` at line 120 — two `Button size="sm"` (h-8 = 32px) in the action bar, below 44px
- **P1:** Various action buttons in header use `size="sm"`

### `/profile` — Minor Issue

- **P2:** Profile update button at `profile-form.tsx:72` — defaults to `h-9` (36px) without `min-h-[44px]`

### `/admin` — Major Issues

- **P0:** `UserRoleManager` table at `user-role-manager.tsx:74` — email `<td>` has no `truncate` or `max-w`, long emails expand table causing horizontal scroll
- **P1:** Role `<select>` at line 89 uses `text-xs` — triggers iOS auto-zoom
- **P1:** Audit log entries at line 147 — dense layout may break at 320px width

---

## 3. Touch Target Audit

WCAG 2.5.5 requires 44x44px minimum for touch targets. Sprint 8 correctly applied `min-h-[44px]` to vote buttons. Other elements remain undersized:

| Element | File:Line | Size | Severity |
|---------|-----------|------|----------|
| Delete proposal button | `proposal-list.tsx:254` | **24px** (h-6) | P1 |
| Mobile nav links | `header.tsx:148` | **~30px** (py-1.5 text-sm) | P1 |
| "New messages" button | `comment-thread.tsx:243` | **~30px** (py-1 text-xs) | P2 |
| Pagination prev/next/page | `pagination.tsx:41,62,78` | **32px** (h-8 w-8) | P1 |
| Export PDF/CSV buttons | `export-buttons.tsx:29` | **32px** (size-sm) | P1 |
| Suggest proposals trigger | `suggest-proposals.tsx:153` | **32px** (size-sm) | P2 |
| Submit proposal button | `proposal-form.tsx:111` | **32px** (size-sm) | P2 |
| Locale switcher | `locale-switcher.tsx:46` | **32px** (size-sm) | P2 |
| Mobile search toggle | `header.tsx:86` | **36px** (size-icon) | P1 |
| User menu trigger | `header.tsx:98` | **36px** (size-icon) | P1 |
| Dark mode toggle | `dark-mode-toggle.tsx:67` | **36px** (size-icon) | P1 |
| "Forgot password" link | `auth/login/page.tsx:183` | **~18px** (text-xs) | P2 |
| "Dismiss" banner button | `auth/login/page.tsx:135` | **~18px** (text-xs) | P2 |
| Sheet close (X) button | `ui/sheet.tsx:78` | **~24px** (no size class) | P2 |
| Dialog close (X) button | `ui/dialog.tsx:72` | **~24px** (no size class) | P2 |
| Profile update button | `profile/profile-form.tsx:72` | **36px** (h-9) | P2 |

**Already correct (44px+):** Vote buttons, discussion sheet trigger, comment textarea, comment send button, AI suggestion vote buttons (on mobile).

---

## 4. Navigation & Header on Mobile

### Current Architecture

The header renders **two sticky rows** on mobile:

1. **Main bar** (h-14 = 56px): Logo | Search | Locale | Dark mode | User menu
2. **Mobile nav** (border-t, ~40px): Dashboard | Projects | (Admin)

**Total sticky height: ~96px** — consumes 14% of viewport on iPhone SE (667px).

### Issues

- **P1:** All icon buttons in main bar are `size="icon"` (36px) — search toggle, dark mode toggle, user menu trigger
- **P1:** Mobile nav links use `py-1.5 text-sm` giving ~30px touch targets
- **P2:** Double-row header consuming ~96px is substantial; consider collapsing to single row or hamburger drawer

### What Works Well

- `sticky top-0 z-50` — correct stacking
- `hidden md:flex` / `md:hidden` breakpoint split — clean
- `aria-label="Mobile navigation"` — accessibility present
- Active link highlighting works on both rows

---

## 5. Forms on Mobile

### Auth Forms (login, register, forgot/reset password)

| Aspect | Status | Notes |
|--------|--------|-------|
| Input font size | Correct | `text-base md:text-sm` prevents iOS zoom |
| Submit buttons | Correct | `w-full` on all primary actions |
| Error messages | Correct | `aria-describedby` linked to fields |
| Password toggle | OK | `w-10 h-full` matches input height |
| Layout | Correct | `w-full max-w-md px-4` centered card |

### Project Forms (new, edit dialog)

| Aspect | Status | Notes |
|--------|--------|-------|
| `<Input>` fields | Correct | Uses shared component with `text-base` |
| `<select>` dropdowns | **Broken** | `text-sm` / no `text-base` — iOS auto-zoom |
| Dialog scrolling | Correct | `max-h-[90vh] overflow-y-auto` |
| Button stacking | Correct | `DialogFooter` does `flex-col-reverse` on mobile |

### Proposal Form (dialog)

| Aspect | Status | Notes |
|--------|--------|-------|
| Dialog sizing | Correct | `sm:max-w-lg max-h-[90vh] overflow-y-auto` |
| Initial vote buttons | Correct | `min-h-[44px]` applied |
| Submit button | Undersized | `size="sm"` = 32px |
| Similarity warnings | Correct | Alert blocks visible on mobile |

### Comment Form

| Aspect | Status | Notes |
|--------|--------|-------|
| Textarea | Correct | `min-h-[44px]` |
| Send button | Correct | `h-[44px] w-[44px]` |
| Keyboard handling | Excellent | `useKeyboardInset()` adjusts for virtual keyboard |
| Safe area | Excellent | `pb-[max(env(safe-area-inset-bottom),0.5rem)]` |

---

## 6. Modals & Dialogs on Mobile

### Dialog (`ui/dialog.tsx`)

- **Width:** `max-w-[calc(100%-2rem)]` — 16px side margins on mobile. Correct.
- **Height:** No base `max-h` constraint (individual usages add `max-h-[90vh]`). Risk for future dialogs.
- **Footer:** `flex-col-reverse gap-2 sm:flex-row sm:justify-end` — stacks buttons vertically on mobile. Correct.
- **Close button:** No explicit size on the X — `XIcon className="size-4"` makes ~24px tap area. **P2.**
- **Backdrop:** `data-[state=open]:animate-in` — smooth overlay. Correct.

### Sheet (`ui/sheet.tsx`)

- **Width:** `w-3/4 sm:max-w-sm` default (right side). DiscussionSheet overrides to `w-full sm:max-w-lg`. Correct.
- **Close button:** Same ~24px issue as Dialog. **P2.**
- **Keyboard handling:** DiscussionSheet uses `pb-[max(env(safe-area-inset-bottom),var(--kb-inset,0px))]`. Excellent.

### Delete Confirmation Dialogs

- Footer buttons stack on mobile via `DialogFooter`. Correct.
- Both Cancel and Delete buttons are `h-9` (36px) — destructive action buttons should be `min-h-[44px]`.

---

## 7. Test Coverage for Mobile Viewports

### Existing Mobile Tests

| Test File | Describe Block | Viewport | What's Tested |
|-----------|---------------|----------|---------------|
| `tests/e2e/auth.test.ts:86-138` | `Mobile Viewport` | 375px | Login/register/forgot-password render, mode switch, redirect |
| `tests/e2e/project-detail.test.ts:56-145` | `Mobile Viewport` | 375x667 | Sidebar hidden, comments fit, no horizontal overflow |
| `tests/e2e/proposal-creation.test.ts:43-83` | (inline) | 375x667 | Proposal dialog flow on mobile |
| `tests/e2e/dashboard.test.ts:66-90` | (inline) | 375px | Compact stat pills, mobile search button |
| `tests/unit/vote-buttons.dom.test.tsx:137` | (inline) | N/A | WCAG 2.5.5 44px touch target assertion |
| `tests/unit/header.dom.test.tsx:107-149` | (inline) | N/A | Mobile nav rendering, active links |
| `tests/e2e/vote-stream.test.ts` | SSE stream | N/A | Not mobile-specific |

### Missing Mobile Test Coverage

- No mobile tests for `/admin` (table overflow, select zoom)
- No mobile tests for `/profile`
- No mobile tests for pagination component
- No mobile tests for export buttons
- No mobile tests for sheet/dialog close button sizing
- No mobile tests for search bar outside-click on touch

### Playwright Config Gap

```ts
// playwright.config.ts:14-18 — ONLY desktop configured
projects: [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
],
```

**No mobile device project.** All mobile E2E tests manually call `setViewportSize()` — this resizes the viewport but does NOT enable touch event emulation, set `deviceScaleFactor`, or use a mobile user agent. Real mobile issues like iOS auto-zoom on `<select>` elements cannot be caught this way.

**Fix:** Add dedicated mobile projects:

```ts
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "Mobile Safari", use: { ...devices["iPhone 13"] } },
  { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
],
```

---

## 8. Patterns from `/home/dc/work/ideator`

Reviewed ideator's component set for any mobile patterns worth porting.

| Pattern | ideator | ideate | Verdict |
|---------|---------|--------|---------|
| Mobile navigation | No mobile nav at all (`hidden md:flex` only) | Dual-row mobile nav | Ideate is better |
| Touch target sizing | No `min-h-[44px]` anywhere | Applied on vote buttons, comments, sheet trigger | Ideate is better |
| Safe area insets | Not handled | `env(safe-area-inset-bottom)` in comments/sheet | Ideate is better |
| Virtual keyboard | Not handled | `useKeyboardInset()` hook | Ideate is better |
| Input zoom prevention | Not addressed | `text-base md:text-sm` on Input/Textarea | Ideate is better |
| Header blur | `backdrop-blur supports-[backdrop-filter]:bg-white/80` | No blur (better for low-end mobile perf) | N/A |

**Nothing worth porting from ideator.** Ideate is more mobile-polished in every dimension.

---

## 9. Prioritized Fix List

### P0 — Critical (Breaks Usability)

| # | Issue | File | Line | Fix |
|---|-------|------|------|-----|
| 1 | Admin email column overflows table on mobile | `src/app/admin/user-role-manager.tsx` | 74 | Add `max-w-[150px] truncate` to email `<td>` |

### P1 — Important (WCAG Violations / Common Touch Paths)

| # | Issue | File | Line | Fix |
|---|-------|------|------|-----|
| 1 | `<select>` status uses `text-sm` — iOS auto-zoom | `src/app/projects/new/page.tsx` | 114 | Add `text-base md:text-sm` |
| 2 | `<select>` status uses `text-sm` — iOS auto-zoom | `src/components/edit-project-dialog.tsx` | 133 | Add `text-base md:text-sm` |
| 3 | `<select>` role uses `text-xs` — iOS auto-zoom | `src/app/admin/user-role-manager.tsx` | 89 | Change to `text-base md:text-xs` |
| 4 | Header search toggle `size="icon"` (36px) | `src/components/header.tsx` | 86 | Add `min-h-[44px] min-w-[44px]` |
| 5 | Header user menu trigger `size="icon"` (36px) | `src/components/header.tsx` | 98 | Add `min-h-[44px] min-w-[44px]` |
| 6 | Dark mode toggle `size="icon"` (36px) | `src/components/dark-mode-toggle.tsx` | 67 | Add `min-h-[44px] min-w-[44px]` |
| 7 | Mobile nav links ~30px (`py-1.5`) | `src/components/header.tsx` | 148 | Change to `py-2.5` or add `min-h-[44px]` |
| 8 | Delete proposal button `h-6` (24px) — destructive | `src/components/proposal-list.tsx` | 254 | Change to `min-h-[44px]` with appropriate padding |
| 9 | Pagination buttons `h-8 w-8` (32px) | `src/components/pagination.tsx` | 41,62,78 | Change to `h-11 w-11` or `min-h-[44px] min-w-[44px]` |
| 10 | Export buttons `size="sm"` (32px) | `src/components/export-buttons.tsx` | 29 | Add `min-h-[44px]` class |
| 11 | No mobile device project in Playwright | `playwright.config.ts` | 14-18 | Add iPhone 13 + Pixel 5 projects |

### P2 — Nice-to-Have (Polish)

| # | Issue | File | Line | Fix |
|---|-------|------|------|-----|
| 1 | "Forgot password" link ~18px tap target | `src/app/auth/login/page.tsx` | 183 | Add `py-2 inline-block` |
| 2 | "Dismiss" banner button ~18px tap target | `src/app/auth/login/page.tsx` | 135 | Add `py-2 inline-block` |
| 3 | Sheet close (X) ~24px tap target | `src/components/ui/sheet.tsx` | 78 | Add `size-11` to close button |
| 4 | Dialog close (X) ~24px tap target | `src/components/ui/dialog.tsx` | 72 | Add `size-11` to close button |
| 5 | SearchBar outside-click only handles `mousedown` | `src/components/search-bar.tsx` | 57 | Add `touchstart` listener |
| 6 | "New messages" button ~30px | `src/components/comment-thread.tsx` | 243 | Add `min-h-[44px]` or `py-3` |
| 7 | Locale switcher 32px (`size="sm"`) | `src/components/locale-switcher.tsx` | 46 | Add `min-h-[44px] min-w-[44px]` |
| 8 | Sticky header ~96px on mobile (two rows) | `src/components/header.tsx` | 50-167 | Consider hamburger menu or bottom nav |
| 9 | Submit buttons in forms 32px (`size="sm"`) | `proposal-form.tsx:111`, `projects/new:137` | — | Add `min-h-[44px]` on mobile |
| 10 | Dialog base has no `max-h` constraint | `src/components/ui/dialog.tsx` | 64 | Add `max-h-[calc(100vh-2rem)] overflow-y-auto` |
| 11 | Profile update button 36px | `src/app/profile/profile-form.tsx` | 72 | Add `min-h-[44px]` |
| 12 | No mobile E2E tests for admin, profile, pagination | `tests/e2e/` | — | Add mobile viewport test cases |

---

## 10. Summary

### What's Already Excellent

The app has strong mobile foundations from prior sprints:

- **Vote buttons** (Sprint 8): `min-h-[44px]`, `active:scale-95` touch feedback, `aria-pressed`
- **Comment thread**: Full virtual keyboard handling via `useKeyboardInset()`, safe area insets, 44px send button
- **Discussion sheet**: Full-width on mobile, keyboard-aware bottom padding
- **Input/Textarea**: `text-base md:text-sm` prevents iOS auto-zoom universally
- **Responsive layouts**: Every page uses correct `sm:`/`md:`/`lg:` breakpoints for grid/flex stacking
- **Dialog footer**: Buttons stack `flex-col-reverse` on mobile

### What Needs Work

The remaining issues cluster into **five fixable areas**:

1. **Header icon buttons** — systematic `size="icon"` (36px) on all header actions. Apply `min-h-[44px] min-w-[44px]` to search, dark mode, user menu, and bump mobile nav link padding.

2. **`<select>` elements** — three `<select>` dropdowns use `text-sm`/`text-xs` without the `text-base` mobile override that `<Input>` and `<Textarea>` already have. Simple class addition.

3. **Utility buttons** — pagination (32px), export (32px), delete proposal (24px). These appear in common touch flows and need `min-h-[44px]`.

4. **Admin table** — email column needs `truncate` + `max-w` to prevent horizontal overflow.

5. **Playwright config** — no mobile device project means touch emulation is absent from all E2E tests. Adding iPhone/Pixel projects enables real mobile testing.

### Estimated Scope

- **P0:** 1 fix, ~5 min
- **P1:** 11 fixes, ~1-2 hours
- **P2:** 12 fixes, ~1-2 hours
- **Total:** 24 fixes across the entire app
