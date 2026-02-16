# Sprint 24 Unified Plan: Project Detail Page Improvements

**Issue:** #45
**Date:** 2026-02-16
**Sources:** `docs/sprint24-analysis-claude.md` (Claude Opus 4.6), `docs/sprint24-analysis-codex.md` (Codex)
**Budget:** ~50 Claude Code turns
**Prerequisites:** #41 and #42 are already fixed

---

## Analysis Synthesis

Both reports independently audited the project detail surface (`src/app/projects/[id]`) and compared it against ideator. Their findings overlap heavily on core issues but diverge on a few points.

### Agreements (both reports flag these)

| Finding | Claude | Codex |
|---------|--------|-------|
| Project descriptions rendered as plain text, not markdown | P0 | P2 |
| Proposal descriptions/summaries rendered as plain text | P0 | P2 |
| Comments rendered as plain text (no markdown) | P1 | P2 |
| Edit page is client-side fetch instead of server component | P0 | Noted |
| Fixed `h-[400px]` in project comments is bad on mobile | P1 | P2 |
| No tests for project CRUD actions | P0/P1 | P1 |
| No E2E for proposal creation, page load, or edit flow | P0/P1 | P1 |
| No mobile viewport E2E tests | P2 | P1 |
| Two-column layout at lg+ would reduce proposal friction | P1 | Noted (ideator comparison) |
| MarkdownRenderer needs a `simple` inline-only mode | P0 | Implicit |

### Disagreements / unique findings

| Finding | Source | Sprint 24 decision |
|---------|--------|--------------------|
| Proposal-comment deadline bypass bug (missing `projectId` in discussion sheet hidden fields) | Codex P0 | **Include** — this is a real enforcement gap |
| Ranking/pagination mismatch (sort by votes is page-local only) | Codex P0 | **Defer** — functional but not user-facing broken; needs query rewrite + migration risk |
| AI similarity only sees current page proposals | Codex P0 | **Defer** — edge case on page 2+; low user impact with 20/page default |
| Threaded comments UI (schema supports `parentId`, UI flattens) | Codex P1 | **Defer** — neither ideator nor ideate renders threads; low priority |
| Route-local `loading.tsx` / `error.tsx` for detail segment | Codex P1 | **Defer** — global layout handles errors; nice-to-have |
| Normalize API 401 vs 307 redirect | Codex P1 | **Defer** — middleware redirect is correct for browser consumers |
| Edit project as dialog instead of page route | Claude P0 | **Include** — large UX win, eliminates client-side fetch |
| Two-column layout with sticky sidebar form | Claude P1 | **Include** — signature UX improvement from ideator |

---

## Sprint 24 Goals

### Goal 1: Markdown rendering for project descriptions
Replace `<p className="whitespace-pre-wrap">` with `<MarkdownRenderer>` for project description on the detail page.

**Files:** `src/app/projects/[id]/page.tsx`
**Test:** Visual check that markdown headings, lists, bold, links render correctly in project description.

### Goal 2: Markdown rendering for proposal content
Replace `whitespace-pre-wrap` divs with `<MarkdownRenderer>` for proposal descriptions and summaries in the accordion.

**Files:** `src/components/proposal-list.tsx`
**Test:** Proposal with markdown content (bold, links, code blocks) renders formatted output.

### Goal 3: Add `simple` mode to MarkdownRenderer
Add a `simple` prop that restricts `allowedElements` to inline-safe elements (`p`, `strong`, `em`, `code`, `a`, `del`) with `unwrapDisallowed`. This prevents block-level elements from breaking compact layouts like comment bubbles.

**Files:** `src/components/markdown-renderer.tsx`
**Test:** Unit test confirming block elements are unwrapped in simple mode; full elements render in default mode.

### Goal 4: Markdown rendering for comments (simple mode)
Use `<MarkdownRenderer simple>` in comment-thread bubbles for both project and proposal comments. Enables bold, italic, links, and inline code without breaking bubble layout.

**Files:** `src/components/comment-thread.tsx`
**Test:** Comment containing `**bold**` and `[link](url)` renders formatted inline content.

### Goal 5: Convert edit project to a dialog
Replace the `/projects/[id]/edit` page route with a Dialog opened from the detail page. The current edit page is a client component that fetches via API on mount — a dialog eliminates the route navigation, client-side fetch, and context loss. The form has only 4 fields (title, description, status, deadline) and fits comfortably in a dialog.

**Files:** `src/app/projects/[id]/page.tsx` (add dialog), `src/app/projects/[id]/edit/page.tsx` (remove or redirect)
**Test:** E2E — open edit dialog, modify title, save, confirm updated title on detail page.

### Goal 6: Two-column layout with sticky proposal form
At `lg+` breakpoint, switch to a two-column grid (`lg:grid-cols-[1.6fr_1fr]`). Move the proposal form from a dialog into a sticky right sidebar (`lg:sticky lg:top-24`). Keep the dialog as fallback for mobile/tablet. This matches ideator's layout and keeps "New Proposal" always visible on desktop.

**Files:** `src/app/projects/[id]/page.tsx`, `src/components/proposal-form.tsx` (extract form body for reuse in sidebar and dialog)
**Test:** At 1280px viewport, proposal form is visible in sidebar without opening a dialog. At 640px, "New Proposal" button opens a dialog.

### Goal 7: Fix proposal-comment deadline bypass
The discussion sheet passes `proposalId` but not `projectId` in its hidden form fields. The `addComment` action only checks deadline closure when `projectId` is present, so proposal comments bypass deadline enforcement. Fix by passing `projectId` through the discussion sheet and ensuring the action enforces deadlines for all comment types.

**Files:** `src/components/discussion-sheet.tsx`, `src/app/projects/[id]/proposals/comment-actions.ts`
**Test:** Unit test — submitting a proposal comment after project deadline returns error. Existing comment tests still pass.

### Goal 8: Fix mobile comment section height
Replace `h-[400px]` with `h-[min(400px,50vh)]` in the project comments section so it adapts to small viewports instead of consuming excessive fixed space.

**Files:** `src/components/project-comments.tsx`
**Test:** At 667px viewport height, comments section is at most 50% of viewport.

### Goal 9: Unit tests for project CRUD actions
Add unit tests for `createProject`, `updateProject`, and `deleteProject` in `src/app/projects/actions.ts`. Both reports flag this as a full coverage gap. Follow the existing pattern in `tests/unit/proposals.test.ts` (auth checks, RBAC, Zod validation, happy path, DB assertions).

**Files:** `tests/unit/project-actions.test.ts` (new)
**Target:** ~15-20 tests covering auth, RBAC, validation, ownership, and happy paths for all three actions.

### Goal 10: E2E test for project detail page load
Verify the detail page renders correctly for a seeded project: title, description (now with markdown), status badge, deadline countdown, proposal list, and comment section.

**Files:** `tests/e2e/project-detail.test.ts` (new)
**Target:** 3-5 assertions covering page structure.

### Goal 11: E2E test for proposal creation flow
Test opening the proposal form (dialog on mobile, sidebar on desktop), filling in title and description, submitting, and confirming the new proposal appears in the list.

**Files:** `tests/e2e/project-detail.test.ts` (same file as Goal 10)
**Target:** 2-3 tests covering create and validation error states.

### Goal 12: Mobile viewport E2E tests
Run the detail page at 375px width and verify: buttons wrap correctly, discussion sheet is full-width, comment section respects viewport height, proposal form opens as dialog (not sidebar).

**Files:** `tests/e2e/project-detail.test.ts` (same file, mobile describe block)
**Target:** 3-4 mobile-specific layout assertions.

---

## Execution Order

Dependency-aware ordering to minimize rework:

| Phase | Goals | Turns (est.) |
|-------|-------|--------------|
| 1. Markdown foundation | 3 (simple mode), 1 (project desc), 2 (proposals), 4 (comments) | ~8 |
| 2. Bug fix | 7 (deadline bypass) | ~4 |
| 3. Layout changes | 5 (edit dialog), 6 (two-column + sidebar form), 8 (mobile height) | ~18 |
| 4. Tests | 9 (unit CRUD), 10 (page load E2E), 11 (proposal creation E2E), 12 (mobile E2E) | ~16 |
| 5. Polish + fix breakage | — | ~4 |
| **Total** | | **~50** |

Phase 1 goes first because Goals 5 and 6 will touch `page.tsx` heavily — better to have markdown rendering settled before restructuring layout. The deadline bug fix (Goal 7) is independent and can slot in after Phase 1. Tests come last because they depend on the final UI state.

---

## Out of Scope (deferred)

| Item | Reason |
|------|--------|
| Server-side vote ranking with pagination | Query rewrite risk; current client-side sort works within page |
| Full proposal corpus for AI similarity | Edge case on page 2+; low impact with 20/page |
| Threaded comments UI | Schema supports it but neither app renders threads; needs design |
| Route-local `loading.tsx` / `error.tsx` | Global layout handles errors adequately |
| API 401 vs 307 normalization | Middleware redirect is correct for browser-first app |
| Proposal edit capability | Neither app supports it; needs design decisions |
| Replace raw `<select>` with shadcn Select | Minor visual inconsistency; low impact |
| Hash-based auto-focus (`#new-proposal`) | Nice polish but not a real user pain point |
| Description toggle glow animation | Cosmetic, defer to future sprint |
