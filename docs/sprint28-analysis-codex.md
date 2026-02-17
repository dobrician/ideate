# Sprint 28 Mobile Audit (Codex)

Date: 2026-02-17

## Scope and method
- Independently audited all app route files in `src/app/**` (`page.tsx`, `loading.tsx`, `error.tsx`, `layout.tsx`, `not-found.tsx`).
- Audited all shared UI files in `src/components/**` plus route-local components used by pages:
  - `src/app/profile/profile-form.tsx`
  - `src/app/admin/user-role-manager.tsx`
  - `src/app/projects/[id]/delete-button.tsx`
- Tested live staging with `curl` against `https://idea.surmont.co/` and key routes.
- Compared mobile patterns with `/home/dc/work/ideator` (not copied; only pattern reference).

## Live curl checks (staging)
- `GET https://idea.surmont.co/` returns `200` with mobile viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`.
- `GET https://idea.surmont.co/api/health` returns healthy JSON (`{"status":"healthy", ...}`).
- Unauthenticated protected routes (`/projects`, `/dashboard`, `/profile`, `/admin`) correctly `307` redirect to `/auth/login?redirect=...`.
- Auth pages (`/auth/login`, `/auth/register`) return `200` and render expected HTML.

## Page-by-page mobile audit

### `/` Home (`src/app/page.tsx`)
- Good: Mobile-first stacking for hero actions (`flex-col` -> `sm:flex-row`).
- Risk: Header controls and nav links shown on this page are below 44px touch target (see global touch-target findings).

### `/auth/login` (`src/app/auth/login/page.tsx`)
- Good: Main CTA buttons are `w-full`, no horizontal overflow in form layout.
- Risk: Input/toggle control height is effectively 36px (`Input h-9` in UI primitive).
- Risk: Password eye toggle is not keyboard-focusable (`tabIndex={-1}` in `src/components/ui/password-input.tsx:30`).

### `/auth/register` (`src/app/auth/register/page.tsx`)
- Good: Single-column card layout scales correctly.
- Risk: Form controls rely on `Input h-9` (36px), under recommended 44px tap size.

### `/auth/forgot-password` (`src/app/auth/forgot-password/page.tsx`)
- Good: Clean, single-column mobile card.
- Risk: Same 36px input height issue.

### `/auth/reset-password` (`src/app/auth/reset-password/page.tsx`)
- Good: Full-width actions within card.
- Risk: Same control height issue.

### `/auth/verify-email` (`src/app/auth/verify-email/page.tsx`)
- Good: Minimal layout, no overflow risks found.

### `/dashboard` (`src/app/dashboard/page.tsx`)
- Good: Dedicated compact mobile stats block (`sm:hidden`) and responsive card grid.
- Risk: Quick-action buttons use default button size (36px).
- Risk: Text-dense list rows with badges and metadata can feel crowded on 320px widths; no functional break, but readability compression.

### `/projects` (`src/app/projects/page.tsx`)
- Good: Responsive project grid (`1/2/3` columns by breakpoint).
- Risk: Pagination controls are 32px (`src/components/pagination.tsx:41`, `:62`, `:78`).

### `/projects/new` (`src/app/projects/new/page.tsx`)
- Good: Form is single-column and readable.
- Risk: Footer action row (`flex gap-3`) does not wrap; long localized labels can squeeze/overflow on narrow devices (`src/app/projects/new/page.tsx:133`).
- Risk: Input/select heights mostly 36–40px.

### `/projects/[id]` (`src/app/projects/[id]/page.tsx`)
- Good: Action areas are wrapped (`flex-wrap`) and major sections are responsive.
- Risk: Top action cluster (export/edit/delete/suggest/new proposal) mixes many small `size="sm"` buttons and can become cramped.
- Risk: Proposal header action cluster (vote + comments) is dense but mostly mitigated by mobile column layout in proposal item.
- Risk: Markdown blocks may overflow horizontally on long unbroken content/code (no global prose overflow guard).

### `/projects/[id]/edit` redirect (`src/app/projects/[id]/edit/page.tsx`)
- No mobile UI (redirect only).

### `/profile` (`src/app/profile/page.tsx` + `src/app/profile/profile-form.tsx`)
- Good: Layout stacks correctly; profile form uses responsive two-column split only from `sm`.
- Risk: Save button uses default size (36px).

### `/admin` (`src/app/admin/page.tsx` + `src/app/admin/user-role-manager.tsx`)
- Good: Stats/grid responsive; user table wrapped in horizontal scroller (`overflow-x-auto`).
- Risk: Role `<select>` is very compact (`text-xs py-1`) and below touch-size guidance.
- Risk: Dense table interactions on mobile rely on horizontal scrolling; workable but low comfort.

### Error/Loading pages (`src/app/**/error.tsx`, `loading.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`)
- Good: Generally centered card layouts with constrained width.
- Risk: Repeated dual-button rows use `flex gap-*` without mobile stacking (can compress/overflow with long translations):
  - `src/app/admin/error.tsx:30`
  - `src/app/dashboard/error.tsx:32`
  - `src/app/profile/error.tsx:27`
  - `src/app/projects/error.tsx:35`
  - `src/app/auth/error.tsx:34`
  - `src/app/error.tsx:37`
  - `src/app/not-found.tsx:24`

## Touch target audit

### Major issues
- Base button sizes are under mobile target guidance:
  - `src/components/ui/button.tsx:24` (`default h-9`)
  - `src/components/ui/button.tsx:26` (`sm h-8`)
- Header mobile controls are 36px icons / compact text buttons:
  - `src/components/header.tsx:85-99`
  - `src/components/locale-switcher.tsx:47`
  - `src/components/dark-mode-toggle.tsx:67`
- Pagination buttons are 32px:
  - `src/components/pagination.tsx:41`, `:62`, `:78`
- PWA dismiss button is 24px:
  - `src/components/pwa-install.tsx:69`
- Tiny destructive actions:
  - `src/components/proposal-list.tsx:257` (`h-6` delete)
  - `src/components/regenerate-summary-button.tsx:51` (`h-7`)

### Good touch implementations
- Vote buttons use `min-h-[44px]`:
  - `src/components/vote-buttons.tsx:88`, `:115`
- Discussion trigger uses `min-h-[44px]`:
  - `src/components/discussion-sheet.tsx:36`
- Proposal form vote options include `min-h-[44px]`:
  - `src/components/proposal-form.tsx:90`, `:97`

## Overflow audit

### Confirmed/likely pressure points
- Mobile header nav is single-row flex without wrap/scroll fallback:
  - `src/components/header.tsx:140`
- Multi-action rows without wrap in forms and dialogs:
  - `src/app/projects/new/page.tsx:133`
  - `src/components/edit-project-dialog.tsx:149`
- Dense proposal item action area can crowd on narrow widths when text strings grow:
  - `src/components/proposal-list.tsx:194-220`
- Markdown rendering lacks explicit long-token overflow handling:
  - `src/components/markdown-renderer.tsx:10`

### Overflow controls that are already good
- Admin user table has horizontal scroll container:
  - `src/app/admin/user-role-manager.tsx:56`
- Dialog/sheet content has max width and vertical overflow handling in most custom dialogs:
  - `src/components/proposal-form.tsx:141`
  - `src/components/suggest-proposals.tsx:159`, `:223`
  - `src/components/edit-project-dialog.tsx:81`

## Forms audit
- Consistent structure and validation flow are good.
- Primary mobile gap is control sizing: inputs/selects/buttons are mostly 36–40px tall.
- Reference pattern from `/home/dc/work/ideator` uses `h-11` for key form controls/actions (better mobile ergonomics):
  - `src/components/project-form.tsx:31`, `:55`, `:70`
  - `src/components/proposal-form.tsx:195`, `:242`

## Modals and sheets audit
- Dialog primitive is generally mobile-safe (`max-w-[calc(100%-2rem)]`), but default `p-6` can feel tight on very small screens:
  - `src/components/ui/dialog.tsx:64`
- Confirmation dialogs use default content and compact action buttons (`size` defaults/sm), so tap comfort is low.
- Discussion sheet is strong on mobile:
  - Full-width sheet with safe-area/keyboard inset handling (`src/components/discussion-sheet.tsx:50`, `src/components/comment-thread.tsx:253`).

## Prioritized fixes

### P0 (highest impact, broadest reach)
1. Raise global mobile tap targets to >=44px for interactive controls.
- Update button and input primitives for mobile defaults:
  - `src/components/ui/button.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/textarea.tsx`
- Keep compact variants only for desktop (`sm:` downscaling) instead of defaulting to compact.

2. Fix header mobile control ergonomics.
- Increase mobile icon and nav control heights.
- Add wrap/scroll behavior for mobile nav row if labels expand.
- Files:
  - `src/components/header.tsx`
  - `src/components/locale-switcher.tsx`
  - `src/components/dark-mode-toggle.tsx`

### P1 (important UX polish)
3. Fix known tiny controls.
- `src/components/pagination.tsx` (32px -> 44px on mobile)
- `src/components/pwa-install.tsx` close button (24px -> >=40px)
- `src/components/proposal-list.tsx` inline delete action (`h-6`)
- `src/components/regenerate-summary-button.tsx` (`h-7`)

4. Make action rows resilient to narrow widths and localization.
- Stack or wrap action rows by default on mobile:
  - `src/app/projects/new/page.tsx`
  - all error pages listed above
  - dialog footers that currently force inline rows

### P2 (quality improvements)
5. Add global markdown overflow protection.
- Add styles for long words/code blocks (`overflow-wrap:anywhere`, `word-break:break-word`, horizontal scroll for code blocks) in markdown renderer container.
- File: `src/components/markdown-renderer.tsx` (and/or `src/app/globals.css`).

6. Improve admin mobile table ergonomics.
- Increase select control size and optionally convert to card/list presentation under `sm`.
- File: `src/app/admin/user-role-manager.tsx`.

## Summary
Mobile responsiveness is structurally solid across routes, but tap target sizing is consistently below recommended touch ergonomics in core primitives and nav/actions. The fastest high-value win is to adjust primitive control sizes and then normalize high-frequency mobile controls (header, pagination, error/action rows).
