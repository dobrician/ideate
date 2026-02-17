# Sprint 34 — UI Consistency Audit & Fix

**Date:** 2026-02-17
**Source:** Manual observation — buttons of varying sizes, some with icons, some with text, inconsistent styling across pages
**Focus:** Establish and enforce consistent button/component patterns throughout the entire app

## Goals

- [x] **Goal 1: Define and document button usage rules** — Create `docs/ui-conventions.md` with clear rules: which button variant+size to use where, when to use icon-only vs text vs icon+text, minimum touch target (44px), spacing conventions. Audit `src/components/ui/button.tsx` — ensure all size variants enforce min-h-[44px] for touch targets (currently only manually added on some buttons). Update the button component so ALL interactive sizes meet 44px minimum.

- [x] **Goal 2: Standardize auth page buttons** — All auth pages (login, register, forgot-password, reset-password, verify-email) should use identical button patterns: primary CTA = `w-full` + default size, secondary actions = `variant="outline" w-full`, back links = `variant="ghost"`. Remove any one-off className overrides. Ensure consistent vertical spacing between buttons.

- [x] **Goal 3: Standardize project detail action buttons** — The action bar (PDF, CSV, Edit, ⋯ menu) should use consistent size and variant. All icon+text buttons same size. The "⋯" more menu trigger should match the other action buttons visually. "← Back" link should be a consistent ghost button or text link pattern.

- [x] **Goal 4: Standardize proposal section buttons** — "+ New Proposal" button, "AI Suggestions" button, vote buttons (👍/👎), expand/collapse chevrons, "Submit" in proposal form, "Cancel" — all should follow consistent sizing. Vote buttons specifically should be identical size. Dialog action buttons (Save/Cancel) should follow a consistent pattern: primary right, outline left.

- [x] **Goal 5: Standardize dashboard and profile buttons** — Dashboard "View all" / "Show more" links should use consistent variant+size. Profile tabs should have consistent styling. "Save" buttons on forms (edit profile, change password) should be identical pattern. Collapsible sections "Show more/less" should use same button style everywhere.

- [x] **Goal 6: Standardize admin panel buttons** — Role dropdown styling, search input, pagination buttons, "Show more" on audit log — all should follow the established conventions. Stat card links should use consistent pattern.

- [ ] **Goal 7: Remove all one-off className hacks** — Search entire codebase for buttons with manual `h-8`, `h-9`, `h-10`, `p-0`, `w-8`, `min-h-[44px]` overrides. Replace with proper size variant from button.tsx. If a needed size doesn't exist, add it to the variant system rather than using className hacks. Goal: zero manual size overrides on Button components.

- [ ] **Goal 8: Visual consistency verification** — After all fixes, run the Playwright screenshot capture script (tests/visual-review/capture-all-pages.ts), resize screenshots, and visually verify buttons are consistent across all pages. List any remaining inconsistencies found.

## Notes

- The core issue: buttons are using a mix of `size="sm"`, `size="default"`, `size="icon"`, plus manual className overrides like `h-8 w-8 p-0`, `min-h-[44px]`, etc.
- Every interactive element must be minimum 44px touch target (Apple/Google HIG)
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
