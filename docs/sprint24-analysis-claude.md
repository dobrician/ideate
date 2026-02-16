# Sprint 24 Analysis: Project Detail Page

**Issue:** #45 — Project Detail Page Improvements
**Date:** 2026-02-16
**Analyst:** Claude Opus 4.6
**Scope:** Full project detail audit — pages, components, API routes, server actions, tests, UX, comparison with ideator
**Prerequisite fixes:** #41 and #42 are already resolved

---

## 1. Current Project Detail State

### What exists (files and line counts)

| File | Lines | Role |
|------|-------|------|
| `src/app/projects/[id]/page.tsx` | 249 | Main detail page — async Server Component |
| `src/app/projects/[id]/queries.ts` | 147 | `getProjectProposals()` with vote aggregation |
| `src/app/projects/[id]/edit/page.tsx` | 210 | Client-side edit form (separate route) |
| `src/app/projects/[id]/delete-button.tsx` | 85 | Delete with confirmation dialog |
| `src/app/projects/[id]/proposals/actions.ts` | 260 | Proposal CRUD, castVote, removeVote |
| `src/app/projects/[id]/proposals/comment-actions.ts` | 111 | addComment server action |
| `src/app/projects/actions.ts` | 208 | Project CRUD server actions |
| `src/app/api/projects/[id]/route.ts` | 52 | GET single project (for edit page) |
| `src/app/api/projects/[id]/export/route.ts` | — | PDF/CSV export endpoint |
| `src/app/api/projects/[id]/summary/route.ts` | — | Regenerate AI summary |
| `src/app/api/proposals/similarity/route.ts` | — | AI similarity check |
| `src/app/api/proposals/suggest/route.ts` | — | AI proposal suggestions |
| `src/app/api/proposals/submit-suggested/route.ts` | — | Bulk-submit AI suggestions |
| `src/app/api/votes/stream/route.ts` | — | SSE real-time vote updates |
| `src/components/proposal-list.tsx` | 286 | Accordion list with vote bars, sorting, SSE |
| `src/components/proposal-form.tsx` | 258 | Dialog form with similarity check |
| `src/components/vote-buttons.tsx` | 98 | Thumbs up/down with aria, toggle-off |
| `src/components/discussion-sheet.tsx` | 53 | Right-side Sheet for proposal comments |
| `src/components/comment-thread.tsx` | 170 | Chat-bubble UI with auto-scroll |
| `src/components/project-comments.tsx` | 35 | Project-level discussion section |
| `src/components/export-buttons.tsx` | 49 | PDF/CSV export buttons |
| `src/components/deadline-countdown.tsx` | 80 | Live countdown timer |
| `src/components/regenerate-summary-button.tsx` | 51 | Regenerate AI summary button |
| `src/components/suggest-proposals.tsx` | 293 | AI suggestion flow with dual dialogs |
| `src/components/markdown-renderer.tsx` | 14 | react-markdown + remark-gfm wrapper |

### What the detail page renders today

1. **Top bar** — Back button, Export (PDF/CSV), Edit button, Delete button (RBAC-gated)
2. **Project Card** containing:
   - **Header**: title (2xl/3xl), status badge (active/draft/archived), deadline countdown
   - **AI Summary**: italic muted text in a `bg-muted/50` box with regenerate button (owner only)
   - **Description**: plain text with `whitespace-pre-wrap` — **not rendered as markdown**
   - **Metadata grid**: created date, last updated date (locale-formatted, 2-col on sm)
   - **Proposals section**: count heading, "Suggest with AI" + "New Proposal" buttons, `ProposalList` accordion, pagination
   - **Project Discussion**: fixed-height (400px) chat-bubble thread

### Data architecture

Server-side fetching in `page.tsx` via `Promise.all`:
- `getProjectProposals(id, userId, limit, offset)` — single query joining proposals + votes + users, then separate queries for user vote map and all proposal comments
- `getProjectComments(id)` — project-level comments from `db/queries.ts`

Real-time updates via SSE (`/api/votes/stream`) consumed by `useVoteStream` hook — updates vote counts and re-sorts proposals without page refresh.

### RBAC model

| Capability | admin | manager | member | viewer |
|---|---|---|---|---|
| Edit/delete own project | via manage_all | via update/delete | - | - |
| Edit/delete any project | Y | - | - | - |
| Create proposal | Y | Y | Y | - |
| Delete own proposal | Y | Y | - | - |
| Cast/remove vote | Y | Y | Y | - |
| Comment | Y | Y | Y | - |

Ownership check: `canManageResource(role, ownerId, userId)` returns true if role has `project:manage_all` OR if `ownerId === userId`.

---

## 2. Markdown Rendering

### Current state

A `MarkdownRenderer` component exists at `src/components/markdown-renderer.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`prose dark:prose-invert prose-sm max-w-none ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
```

**Problem: the component exists but is barely used.** It is only referenced in one place:

| Location | Renders via | Markdown? |
|---|---|---|
| `suggest-proposals.tsx` (AI detail dialog) | `<MarkdownRenderer>` | Yes |
| Project description (`page.tsx:163-165`) | `<p className="whitespace-pre-wrap">` | **No — plain text** |
| Proposal description (`proposal-list.tsx:225`) | `<div className="whitespace-pre-wrap">` | **No — plain text** |
| Proposal summary (`proposal-list.tsx:225`) | `<div className="whitespace-pre-wrap">` | **No — plain text** |
| AI summary (`page.tsx:153`) | `<p className="text-sm italic">` | **No — plain text** |
| Comment content (`comment-thread.tsx:83`) | `{comment.content}` | **No — plain text** |

### Gaps

1. **Project descriptions are not markdown-rendered.** Users who write markdown (headings, lists, links, bold) see raw syntax.
2. **Proposal descriptions/summaries are not markdown-rendered.** AI-generated summaries may include markdown formatting that displays as raw text.
3. **Comments are not markdown-rendered.** Links, bold, and inline formatting are lost.
4. **No "simple" mode.** Ideator's `MarkdownRenderer` has a `simple` prop that restricts to inline elements (`p, strong, em, code, a, del`) with `unwrapDisallowed` — safe for use in titles, comments, and compact areas where block elements would break layout.
5. **No XSS sanitization concern** — `react-markdown` does not render raw HTML by default, so this is safe. But if `rehype-raw` is ever added, sanitization would be needed.

### Recommendation

- Use `<MarkdownRenderer>` for project descriptions, proposal descriptions, and AI summaries
- Add a `simple` mode (inline-only allowed elements) for comment bubbles and compact previews
- Do NOT render titles through markdown (keep as plain text to avoid layout issues)

---

## 3. Modal Dialogs and Forms

### Current modal inventory

| Dialog | Component | Type | Trigger |
|---|---|---|---|
| New Proposal | `proposal-form.tsx` | Radix Dialog | "New Proposal" button |
| Delete Project | `delete-button.tsx` | Radix Dialog | "Delete" button |
| Delete Proposal | `proposal-list.tsx` | Radix Dialog | "Delete" in accordion |
| AI Suggestions list | `suggest-proposals.tsx` | Radix Dialog | "Suggest with AI" button |
| AI Suggestion detail | `suggest-proposals.tsx` | Radix Dialog (stacked) | "View details" eye button |
| Proposal Discussion | `discussion-sheet.tsx` | Radix Sheet (slide-in right) | Comment count badge |

### Assessment

**What works well:**
- All dialogs use the same Radix UI Dialog primitive via `src/components/ui/dialog.tsx` — consistent animation, overlay, focus trap, and keyboard handling
- `DialogContent` has `showCloseButton` prop (defaults to true), `max-w-[calc(100%-2rem)]` for mobile safety
- `DialogFooter` properly stacks on mobile (`flex-col-reverse`) and rows on desktop (`sm:flex-row`)
- The proposal form dialog has `max-h-[90vh] overflow-y-auto` for long forms
- AI suggestion dialog uses `sm:max-w-2xl max-h-[85vh] overflow-y-auto` — wider for card layout

**Gaps and issues:**

1. **Edit project is a full-page navigation, not a modal.** Clicking "Edit" navigates to `/projects/[id]/edit`, a separate client component that fetches the project via API, losing the user's scroll position and context. Ideator keeps everything in-page. Converting to a dialog or sheet would be a significant UX improvement.

2. **Edit page uses client-side fetch on mount.** `edit/page.tsx` is a `"use client"` component that calls `fetch(/api/projects/${id})` in `useEffect`. This means a loading spinner, an extra network round-trip, and no server-side rendering. If kept as a separate page, it should be a Server Component that fetches data directly.

3. **Edit form uses a raw `<select>` element** (`edit/page.tsx:171-181`) instead of a shadcn Select component — inconsistent with the rest of the UI. The `new/page.tsx` has the same issue.

4. **No edit proposal flow.** Users can create and delete proposals but cannot edit them. There is no edit button, no edit dialog, and no `updateProposal` server action.

5. **No inline edit for project title/description.** The edit page is the only way to modify project metadata.

6. **Stacked dialog z-index management.** The AI suggestion detail dialog stacks on top of the suggestions list dialog. Both use `z-50` from the Dialog primitive. This works because Radix manages stacking order internally, but if custom modals are added, z-index conflicts could arise.

7. **Similarity check happens in the dialog** (`proposal-form.tsx`) with amber warning cards but does **not block submission** — the user sees warnings but can still submit. This is the correct design choice (advisory, not blocking), matching ideator's "Submit Anyway" flow.

---

## 4. Layout, Spacing, and Responsiveness

### Page layout

```
container mx-auto max-w-4xl px-4 py-6 sm:py-8
```

Single-column layout, max 896px (`max-w-4xl`). Everything stacks vertically inside one `<Card>`.

### Responsive breakpoints used

| Element | Mobile | sm (640px) | lg (1024px) |
|---|---|---|---|
| Top bar buttons | stacked column | row with flex-wrap | row |
| Title | text-2xl | text-3xl | — |
| Status + deadline | stacked | row with gap-4 | — |
| Metadata grid | 1 col | 2 cols | — |
| Proposal trigger | stacked title + votes | side-by-side | — |
| Discussion sheet | full width | max-w-lg | — |

### Assessment

**What works well:**
- Clean responsive design using `flex-col → sm:flex-row` patterns throughout
- Proper mobile handling for the top bar buttons (wrapping allowed)
- `max-w-4xl` (896px) is appropriate for a reading-focused detail page
- Vote buttons use `shrink-0` to prevent compression on small screens
- Accordion triggers handle overflow gracefully with `min-w-0 flex-1` on title

**Gaps and issues:**

1. **Single-column layout wastes space on large screens.** Ideator uses a `lg:grid-cols-[1.6fr,1fr]` two-column layout with proposals on the left and the proposal form sticky on the right. On a 1440px display, ideate's `max-w-4xl` leaves 544px unused on each side. A two-column approach would improve engagement by keeping the "New Proposal" form always visible while scrolling proposals.

2. **Proposal form is hidden behind a dialog.** The "New Proposal" button opens a dialog, so users must actively seek it out. Ideator keeps the proposal form always visible in the right sidebar (at `lg:sticky lg:top-24`). For a voting/ideation tool, reducing friction to propose is critical.

3. **Project Discussion section has a hard-coded `h-[400px]`.** This works on desktop but on mobile (small viewport), 400px of fixed height is excessive — it forces users to scroll within a scroll container. Should be `h-[min(400px,50vh)]` or similar.

4. **No sticky proposal form or action buttons.** On a project with many proposals, the user must scroll back to the top to create a new proposal. The top bar with "Edit" and "Export" buttons scrolls out of view.

5. **Vote bar background gradient has no mobile consideration.** The proportional green/red gradient fills work visually, but on very narrow screens the `width: N%` values may produce sub-pixel rendering artifacts. Not a critical issue.

6. **Deadline countdown badge inconsistency.** The countdown component uses explicit background classes (`bg-red-100`, `bg-amber-100`, `bg-blue-100`) while the status badge uses the `statusBadgeClass()` helper. These should use a unified badge pattern.

7. **Accordion item spacing.** `ProposalList` uses `<Accordion className="space-y-2">` giving 8px gaps between items. With the vote-bar gradient backgrounds, tighter spacing (`space-y-1` or `space-y-1.5`) might look cleaner, but this is subjective.

---

## 5. Test Coverage Gaps

### Existing test coverage

**Unit tests (Vitest):**

| Test file | What it covers | Tests |
|---|---|---|
| `proposals.test.ts` | `createProposal` action: auth, RBAC, Zod, happy path, CSRF | 9 |
| `vote-actions.test.ts` | `deleteProposal`, `castVote`, `removeVote`: auth, perms, deadline, DB | ~12 |
| `comment-actions.test.ts` | `addComment`: auth, validation, proposal vs project, threading | ~10 |
| `proposal-list.dom.test.tsx` | DOM rendering: empty state, titles, sort order, bar widths, author | 5 |
| `vote-buttons.dom.test.tsx` | DOM rendering: counts, aria-pressed, titles, click handlers, group | 8 |

**E2E tests (Playwright):**

| Test file | What it covers | Tests |
|---|---|---|
| `voting.test.ts` | Pro vote, contra vote, toggle, bar rendering, count updates | 5 |
| `comments.test.ts` | Project comment (button + Enter), empty rejection, bubble layout, proposal comment via sheet | 5 |
| `ai-suggestions.test.ts` | Full flow, loading state, error state, detail dialog, vote toggle | 5 |

### What is NOT tested

**Server actions — missing coverage:**

| Gap | Severity | Notes |
|---|---|---|
| `updateProject` action | High | No unit tests at all — validation, RBAC, ownership, DB update |
| `deleteProject` action | High | No unit tests — only E2E delete confirmation |
| `createProject` action | High | No unit tests — validation, RBAC, DB insert, redirect |
| `addComment` deadline enforcement | Medium | Tested in unit tests but not E2E |
| `castVote` deadline enforcement | Medium | Tested in unit tests but not E2E |

**Component DOM tests — missing coverage:**

| Gap | Severity | Notes |
|---|---|---|
| `ProposalForm` dialog | High | No DOM test — form validation, similarity warnings, initial vote toggle, submit/cancel |
| `DiscussionSheet` | Medium | No DOM test — sheet opening, comment thread rendering |
| `ProjectComments` | Medium | No DOM test — section heading, comment count, thread integration |
| `DeadlineCountdown` | Medium | No DOM test — expired state, urgent state, normal countdown, tick behavior |
| `ExportButtons` | Low | No DOM test — button rendering, window.open calls |
| `RegenerateSummaryButton` | Low | No DOM test — loading state, success/error toast |
| `SuggestProposalsButton` | Low | Covered by E2E but no unit/DOM test — hard to mock in jsdom |
| `MarkdownRenderer` | Low | No test — trivially simple component |
| `DeleteProjectButton` | Low | No DOM test — dialog open/close, delete call |

**E2E tests — missing coverage:**

| Gap | Severity | Notes |
|---|---|---|
| Project detail page load and layout | High | No E2E test that verifies the page renders correctly with title, description, status, deadline |
| Edit project flow | High | No E2E test for navigating to edit, modifying fields, saving, seeing updates |
| Delete project flow | Medium | No E2E test for delete confirmation and redirect |
| Proposal creation via dialog | High | No E2E test for opening the form dialog, filling it, submitting, and seeing the new proposal |
| Pagination of proposals | Medium | No E2E test — requires >20 proposals to trigger |
| Export buttons | Low | Only API-level test in `api.test.ts`, no button-click E2E |
| Deadline countdown display | Low | No E2E test verifying countdown renders on a project with deadline |
| SSE real-time vote updates | Low | Difficult to test — would require multi-tab or multi-user setup |
| Mobile responsive layout | Medium | No viewport-specific E2E tests |

**API routes — missing coverage:**

| Gap | Severity | Notes |
|---|---|---|
| `GET /api/projects/[id]` | Medium | No unit test — only implicitly tested by edit page E2E |
| `POST /api/projects/[id]/summary` | Low | Tested via `project-summary.test.ts` at the lib level |
| `POST /api/proposals/submit-suggested` | Medium | Covered by E2E mock but no unit test for the route handler |

---

## 6. Comparison with Ideator

### Feature parity matrix

| Feature | Ideator | Ideate | Gap |
|---|---|---|---|
| Markdown rendering — descriptions | Yes (react-markdown, full mode) | **No** (whitespace-pre-wrap) | **Major** |
| Markdown rendering — comments | Yes (simple mode, inline-only) | **No** (plain text) | Medium |
| Markdown rendering — titles | Yes (simple mode) | No (plain text) | Minor — titles shouldn't need markdown |
| Two-column layout at lg+ | Yes (1.6fr/1fr grid) | **No** (single column, max-w-4xl) | **Major** |
| Sticky proposal form sidebar | Yes (lg:sticky lg:top-24) | **No** (form in dialog) | **Major** |
| Proposal edit capability | No | No | Parity — both lack this |
| AI similarity check | Yes (blocks submit, shows bar) | Yes (advisory warnings in dialog) | Parity — ideate's is less obtrusive |
| AI proposal suggestions | Yes (dual-modal, hover-reveal votes) | Yes (dual-dialog, explicit votes) | Parity — slightly different UX |
| Real-time vote updates (SSE) | No | **Yes** | Ideate is ahead |
| Vote bar visualization | Yes (center-anchored gradient) | Yes (edge-anchored gradient) | Different approach — both valid |
| Discussion sheet (slide-in) | Yes (right panel, iMessage bubbles) | Yes (right panel, chat bubbles) | Parity |
| Project-level comments | No (only proposal comments) | **Yes** | Ideate is ahead |
| Summary vs full description toggle | Yes (with glow animation hint) | Yes (button in accordion content) | Parity — ideator's is more discoverable |
| Description toggle glow animation | Yes (pulse after 2.8s) | **No** | Minor UX polish |
| Regenerate AI summary | Yes (owner-only) | Yes (owner/admin) | Parity |
| Hash-based auto-focus (#proposal-title) | Yes | **No** | Minor UX |
| Export (PDF/CSV) | No | **Yes** | Ideate is ahead |
| Pagination | No | **Yes** (20 per page) | Ideate is ahead |
| Deadline countdown | No (static date display) | **Yes** (live countdown) | Ideate is ahead |
| isNegativeInitiative field | Schema only (unused) | Schema field exists | Both unused |
| MarkdownRenderer simple mode | Yes | **No** | Medium gap |
| Edit as dialog vs page | In-page (no separate route) | **Separate /edit route** | UX gap |
| CSRF protection | No | **Yes** | Ideate is ahead (security) |
| Audit logging | No | **Yes** | Ideate is ahead |
| i18n | Yes (custom) | Yes (custom, en/ro) | Parity |

### Where ideate is ahead of ideator

1. **Real-time SSE vote streaming** — votes update live without page refresh
2. **Project-level comments** — ideator only has proposal comments
3. **CSRF protection** on all mutations
4. **Audit logging** for all create/update/delete/vote actions
5. **Export functionality** (PDF/CSV)
6. **Proposal pagination** (20 per page)
7. **Live deadline countdown** with urgency colors
8. **Notification system** (notifyVote, notifyComment)

### Where ideator is ahead of ideate

1. **Markdown rendering everywhere** — descriptions, proposals, comments all rendered
2. **Two-column responsive layout** — proposal form always visible
3. **MarkdownRenderer simple mode** — safe inline rendering for compact areas
4. **Description toggle with glow hint** — better discoverability
5. **Hash-based scroll + auto-focus** — `#proposal-title` deep-links to form
6. **In-page editing** — no route navigation to edit project metadata
7. **Segmented vote button styling** — grouped buttons in a border container
8. **Center-anchored vote bar** — arguably clearer vote split visualization

---

## 7. Prioritized Recommendations

### P0 — High impact, should be in Sprint 24

| # | Recommendation | Effort | Rationale |
|---|---|---|---|
| 1 | **Render project descriptions with `<MarkdownRenderer>`** | Small | Replace `<p className="whitespace-pre-wrap">` at `page.tsx:164` with `<MarkdownRenderer content={projectData.description}>`. One-line change, immediate quality improvement. Users and AI both write markdown. |
| 2 | **Render proposal descriptions/summaries with `<MarkdownRenderer>`** | Small | Replace `whitespace-pre-wrap` div at `proposal-list.tsx:225` with `<MarkdownRenderer>`. AI-generated summaries may contain markdown formatting. |
| 3 | **Add `simple` mode to `MarkdownRenderer`** | Small | Add a `simple` prop that restricts `allowedElements` to `['p', 'strong', 'em', 'code', 'a', 'del']` with `unwrapDisallowed`. Use for comment bubbles and compact previews to prevent block elements from breaking layout. |
| 4 | **Convert edit project to a dialog or sheet** | Medium | Replace the `/projects/[id]/edit` route with a Dialog or Sheet opened from the detail page. Eliminates the context-losing navigation, removes the client-side fetch, and keeps users oriented. The edit form is small enough (4 fields) to fit comfortably in a dialog. |
| 5 | **Add proposal creation E2E test** | Small | No E2E test covers opening the proposal form dialog, filling fields, and submitting. This is a critical user flow with zero E2E coverage. |
| 6 | **Add project detail page load E2E test** | Small | Verify the page renders title, description, status badge, deadline, and proposal list for a seeded project. |

### P1 — Medium impact, strong improvements

| # | Recommendation | Effort | Rationale |
|---|---|---|---|
| 7 | **Two-column layout at lg+ breakpoint** | Medium | Add `lg:grid-cols-[1.6fr,1fr]` layout. Move proposal form from dialog into a sticky right sidebar at `lg:sticky lg:top-24`. Keep the dialog as fallback for mobile. Keeps the "New Proposal" form always visible, reducing friction. |
| 8 | **Render comment content as markdown (simple mode)** | Small | Use `<MarkdownRenderer simple>` in `comment-thread.tsx:83` instead of raw `{comment.content}`. Enables bold, italic, links, and code in comments. |
| 9 | **Replace raw `<select>` with shadcn Select** | Small | The edit and new project forms use a raw `<select>` element for status. Replace with the shadcn/ui Select component for visual consistency. |
| 10 | **Add unit tests for project CRUD actions** | Medium | `createProject`, `updateProject`, and `deleteProject` in `projects/actions.ts` have zero unit tests. Follow the pattern in `proposals.test.ts`. |
| 11 | **Add `ProposalForm` DOM test** | Medium | Test dialog open/close, form validation, similarity warning display, initial vote toggle, submit behavior. |
| 12 | **Add `DeadlineCountdown` DOM test** | Small | Test expired state, urgent state, normal countdown rendering. Mock `Date.now()` and `setInterval`. |
| 13 | **Fix project comment section height on mobile** | Small | Change `h-[400px]` to `h-[min(400px,50vh)]` in `project-comments.tsx:26` to prevent excessive fixed height on small viewports. |

### P2 — Nice-to-have polish

| # | Recommendation | Effort | Rationale |
|---|---|---|---|
| 14 | **Add proposal edit capability** | Medium | Neither ideate nor ideator supports editing proposals after creation. Add an "Edit" button (owner/admin) that opens a dialog to modify title and description, with a `updateProposal` server action. |
| 15 | **Hash-based auto-focus for proposal form** | Small | When URL contains `#new-proposal`, auto-open the proposal form dialog (or focus the sidebar form in two-column layout). Enables deep-linking from other pages. |
| 16 | **Description toggle glow hint** | Small | Add a pulsing ring animation on the "Show full description" button after 3 seconds to draw attention. Port from ideator's `ProjectDescriptionToggle`. |
| 17 | **Sticky top bar on scroll** | Small | Make the back/edit/export button bar sticky so actions remain accessible when scrolling long proposal lists. |
| 18 | **Add edit project E2E test** | Medium | Navigate to edit, modify fields, save, verify updates appear on the detail page. |
| 19 | **Add delete project E2E test** | Small | Click delete, confirm dialog, verify redirect to project list. |
| 20 | **Add mobile viewport E2E tests** | Medium | Test the detail page at 375px width to verify responsive layout, button wrapping, and discussion sheet behavior. |

### Not recommended (avoid)

| Item | Reason |
|---|---|
| Center-anchored vote bar (ideator style) | Ideate's edge-anchored gradient is clearer and already tested. Not worth redesigning. |
| Remove dialog for proposal form | Keep dialog as the mobile experience even if two-column sidebar is added for desktop. |
| Add `isNegativeInitiative` UI | Field exists in schema but both projects leave it unused. No user demand signals. |
| Render titles through markdown | Titles should stay as plain text. Markdown in titles creates layout unpredictability. |

---

## Appendix A: File Dependency Graph

```
page.tsx (Server Component)
├── queries.ts ─────────── getProjectProposals()
├── db/queries.ts ──────── getProjectComments()
├── delete-button.tsx ──── Dialog + deleteProject action
├── proposal-form.tsx ──── Dialog + createProposal action + /api/proposals/similarity
├── proposal-list.tsx
│   ├── vote-buttons.tsx ── castVote / removeVote actions
│   ├── discussion-sheet.tsx
│   │   └── comment-thread.tsx ── addComment action
│   └── lib/use-vote-stream.ts ── /api/votes/stream (SSE)
├── project-comments.tsx
│   └── comment-thread.tsx
├── export-buttons.tsx ──── /api/projects/[id]/export
├── deadline-countdown.tsx
├── regenerate-summary-button.tsx ── /api/projects/[id]/summary
├── suggest-proposals.tsx
│   ├── markdown-renderer.tsx
│   ├── /api/proposals/suggest
│   └── /api/proposals/submit-suggested
└── pagination.tsx
```

## Appendix B: Test Coverage Summary

```
                        Unit    DOM     E2E
createProposal          9/9     -       0     ← E2E gap
deleteProposal          3/3     -       0
castVote                5/5     -       5/5
removeVote              3/3     -       (in voting tests)
addComment              10/10   -       5/5
createProject           0       -       0     ← full gap
updateProject           0       -       0     ← full gap
deleteProject           0       -       0     ← full gap
ProposalList            -       5/5     -
VoteButtons             -       8/8     -
ProposalForm            -       0       0     ← full gap
DiscussionSheet         -       0       (in comments E2E)
ProjectComments         -       0       (in comments E2E)
DeadlineCountdown       -       0       0     ← full gap
ExportButtons           -       0       (API test only)
SuggestProposals        -       0       5/5
MarkdownRenderer        -       0       -
Page load/layout        -       -       0     ← E2E gap
Edit flow               -       -       0     ← E2E gap
Delete flow             -       -       0     ← E2E gap
Mobile responsive       -       -       0     ← E2E gap
```
