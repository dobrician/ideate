# Sprint 27 Analysis: Voting & Proposals Feature

**Date:** 2026-02-17
**Analyst:** Claude Opus 4.6
**Scope:** Complete audit of voting, proposals, SSE streaming, and comparison with `/home/dc/work/ideator`

---

## 1. Current Voting Implementation

### Architecture Overview

The voting system is a server-action-driven upsert model with SSE-based real-time propagation. Users cast binary votes (+1 pro / -1 contra) on proposals via `castVote`, with a toggle-to-remove pattern via `removeVote`.

### Database Layer (`src/db/schema.ts`)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `proposals` | `id`, `project_id` (FK, cascade), `title`, `description`, `summary`, `is_negative_initiative`, `user_id` (FK, set null) | `is_negative_initiative` exists but is never used anywhere |
| `votes` | `proposal_id` (FK, cascade), `user_id` (FK, cascade), `value` (int: 1/-1), `created_at` | Composite PK `(proposal_id, user_id)` enforces one vote per user per proposal |

**Indexes** (migration `0002`): `idx_votes_user_id`, `idx_votes_proposal_id`, `idx_proposals_project_id`, `idx_proposals_user_id`, `idx_proposals_created_at`.

### Server Actions (`src/app/projects/[id]/proposals/actions.ts`)

| Action | Flow | Notes |
|--------|------|-------|
| `createProposal` | CSRF -> auth -> RBAC (`proposal:create`) -> Zod validation -> deadline check -> AI summary -> DB insert (proposal + initial vote) -> audit -> revalidate | AI summary is `await`ed synchronously; no timeout. Initial vote defaults to +1 |
| `deleteProposal` | CSRF -> auth -> RBAC (`proposal:delete`) -> ownership check via `canManageResource` -> DB delete (cascades) -> audit -> revalidate | Members cannot delete even their own proposals |
| `castVote` | CSRF -> auth -> RBAC (`vote:cast`) -> value validation (1/-1) -> deadline check -> DB upsert (`onConflictDoUpdate`) -> audit -> SSE emit -> email notify (fire-and-forget) -> revalidate | `emitVoteUpdate` does a second DB query for fresh counts |
| `removeVote` | CSRF -> auth -> RBAC (`vote:cast`) -> deadline check -> DB delete -> audit -> SSE emit -> revalidate | Same pattern as `castVote` minus the notification |

### RBAC Matrix (`src/lib/rbac.ts`)

| Role | `proposal:create` | `proposal:delete` | `vote:cast` |
|------|---|---|---|
| admin | yes | yes | yes |
| manager | yes | yes | yes |
| member | yes | **no** | yes |
| viewer | no | no | no |

---

## 2. Proposal UX

### Components

#### `ProposalList` / `ProposalItem` (`src/components/proposal-list.tsx`)

- **Sorting:** Net score descending (up - down), tie-break by fewer downvotes
- **Accordion:** `type="multiple"` -- users can expand several proposals simultaneously
- **Vote bar:** Two overlaid `<div>` elements inside `AccordionTrigger`, scaled proportionally to `maxTotalVotes` across all proposals in the project. Green from left edge, red from right edge via `ml-auto`. Both marked `pointer-events-none` and `aria-hidden="true"`
- **Inline voting:** `VoteButtons` rendered inside the trigger row with `e.stopPropagation()` to prevent accordion toggle -- users can vote without expanding
- **Discussion:** `DiscussionSheet` button also in trigger row
- **Expanded content:** Shows summary by default with toggle to full description (rendered via `MarkdownRenderer`). Date formatting, delete button (with confirmation dialog) for owner/admin

#### `ProposalForm` / `ProposalFormInline` (`src/components/proposal-form.tsx`)

- **Two variants:** `ProposalForm` wraps in a `Dialog` for mobile; `ProposalFormInline` renders directly in the sticky desktop sidebar
- **Shared internals:** Both use `ProposalFormFields` + `useProposalForm` hook
- **Fields:** Title (5-200 chars, required), Description (textarea, 5000 max), Initial Vote (Pro/Contra toggle buttons)
- **Success handling:** Toast + form reset + `requestAnimationFrame(() => setOpen(false))`

#### `useProposalForm` Hook (`src/components/use-proposal-form.ts`)

- **Similarity check:** 800ms debounce after last keystroke, min 5 chars, calls `/api/proposals/similarity`
- **Filtering:** Server returns all matches; client filters at `similarity > 40` (applied twice -- once in the fetch callback at line 61, again redundantly at line 86)
- **State:** `useActionState` for `createProposal`, controlled inputs for title/description

#### `SuggestProposalsButton` (`src/components/suggest-proposals.tsx`)

- **Flow:** Button click -> `POST /api/proposals/suggest` -> display suggestion cards -> user votes pro/contra/skip on each -> submit selected via `POST /api/proposals/submit-suggested`
- **Suggestion cards:** Title, truncated summary, ThumbsUp/ThumbsDown/Eye buttons
- **Detail dialog:** Full markdown content of a suggestion

### Mobile Considerations

- `ProposalForm` uses Dialog with `max-h-[90vh] overflow-y-auto` for mobile
- `SuggestionCard` buttons use `h-8 sm:h-7` for larger touch targets on mobile
- Proposal trigger uses `flex-col gap-2 / sm:flex-row` for responsive layout
- `DiscussionSheet` sets `min-h-[44px]` on its trigger button (WCAG touch target)
- Vote buttons do **not** set an explicit minimum touch target height

---

## 3. Vote Bar Rendering and Accessibility

### Vote Bar Implementation

```
proposal-list.tsx:153-155
```

```typescript
const voteWidth = maxTotalVotes > 0 ? 100 / maxTotalVotes : 0;
const greenWidth = Math.round(upvotes * voteWidth);
const redWidth = Math.round(downvotes * voteWidth);
```

Bars are rendered as absolute-positioned overlays inside `AccordionTrigger`:
- Green bar: `bg-gradient-to-r from-green-500/20 to-green-500/5`, anchored left
- Red bar: `bg-gradient-to-l from-red-500/20 to-red-500/5`, anchored right via `ml-auto`
- Both use `transition-all duration-300` for smooth width animation on live updates
- Container: `pointer-events-none absolute inset-0`, `aria-hidden="true"`

### Accessibility Audit

**Good:**
- `VoteButtons` uses `role="group"` with `aria-label="Vote on this proposal"`
- Each button has `aria-pressed` (correct toggle pattern)
- `aria-label` includes count and "Remove vote" hint when active
- Icons use `aria-hidden="true"`
- Vote bar overlay correctly marked decorative with `aria-hidden="true"`
- Accordion from Radix UI provides keyboard navigation out of the box

**Issues Found:**

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| A1 | Vote buttons show no loading indicator when `isPending` -- buttons are disabled but no spinner or `aria-live` region announces the pending state to screen readers | Medium | `vote-buttons.tsx:56,78` |
| A2 | Vote buttons lack explicit `min-h-[44px]` for WCAG 2.5.5 touch target. The discussion button sets this; vote buttons do not | Medium | `vote-buttons.tsx:52-96` |
| A3 | Similarity warnings have no `role="alert"` or `aria-live` -- screen readers won't announce new warnings dynamically | Medium | `proposal-form.tsx:67-81` |
| A4 | Error messages in proposal form not linked to inputs via `aria-describedby` | Low | `proposal-form.tsx:99-103` |
| A5 | `SuggestionCard` ThumbsUp/ThumbsDown buttons have no `aria-label` -- only icons, no text for screen readers | High | `suggest-proposals.tsx:269-284` |
| A6 | Detail dialog in `SuggestProposalsButton` doesn't restore focus to the triggering element when closed | Low | `suggest-proposals.tsx:219-245` |

---

## 4. SSE Real-Time Voting

### Server-Side (`src/lib/vote-events.ts`)

In-process pub-sub using `Map<projectId, Set<VoteListener>>`:
- `subscribeVotes(projectId, listener)` -- returns unsubscribe function
- `emitVoteChange(event)` -- fans out to all listeners for a project
- Listener errors silently swallowed (correct -- prevents cascade failures)
- Cleanup: removes project key from map when last listener unsubscribes

### SSE Endpoint (`src/app/api/votes/stream/route.ts`)

- Auth-gated (401 if not logged in)
- Requires `?projectId=xxx` query param
- Uses `ReadableStream` with `TextEncoder`
- Immediate `: keepalive\n\n` on connect, then every 30 seconds via `setInterval`
- Cleanup via `request.signal.addEventListener("abort", ...)` clears interval + unsubscribes
- `cancel()` method only calls `unsubscribe()` but does **not** clear the keepalive interval

### Client-Side (`src/lib/use-vote-stream.ts`)

- Creates `EventSource` connection per `projectId`
- Parses `data:` events into `Map<proposalId, { proposalId, upvotes, downvotes }>`
- On error: closes connection, reconnects after 3 seconds (flat, no backoff)
- Cleanup on unmount: clears reconnect timer, closes EventSource

### Issues Found

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| S1 | **`cancel()` doesn't clear keepalive interval** -- only `abort` handler clears it. If `cancel()` fires first, the interval runs until it throws | Medium | `stream/route.ts:64-66` |
| S2 | **No exponential backoff on reconnect** -- flat 3s retry can hammer the server during sustained outages | Medium | `use-vote-stream.ts:43` |
| S3 | **No max retry count** -- client will retry forever, even if the session has expired | Low | `use-vote-stream.ts:40-44` |
| S4 | **`userVote` not updated via SSE** -- `useVoteStream` only carries aggregate counts, not per-user vote state. After voting, the `aria-pressed` highlight can be momentarily stale until Next.js revalidation completes | Medium | `proposal-list.tsx:210` |
| S5 | **In-process only** -- `vote-events.ts` uses module-level `Map`; won't work across multiple server instances. Acceptable for SQLite single-instance deployment, but a scaling bottleneck | Low (by design) | `vote-events.ts:15` |
| S6 | **No `X-Accel-Buffering: no` header** -- SSE may be buffered behind Nginx reverse proxy | Low | `stream/route.ts:69-74` |

---

## 5. Test Coverage Gaps

### Existing Tests

| File | Type | Coverage |
|------|------|----------|
| `tests/unit/vote-actions.test.ts` | Vitest | `castVote`, `removeVote`, `deleteProposal` -- auth, RBAC, upsert, deadline, DB errors. **Good** |
| `tests/unit/proposals.test.ts` | Vitest | `createProposal` -- auth, RBAC, validation, AI summary, initial vote, deadline, CSRF. **Good** |
| `tests/unit/vote-events.test.ts` | Vitest | `subscribeVotes`, `emitVoteChange`, unsubscribe, error isolation, cleanup. **Excellent** |
| `tests/unit/vote-buttons.dom.test.tsx` | JSDOM | Rendering, `aria-pressed`, `aria-label`, action dispatch. **Good** |
| `tests/unit/proposal-list.dom.test.tsx` | JSDOM | Empty state, titles, sorting, vote bar proportions, author names. **Good** |
| `tests/e2e/voting.test.ts` | Playwright | Vote pro, contra, change vote, vote bar visibility, count updates. **Good** |
| `tests/e2e/proposal-creation.test.ts` | Playwright | Desktop flow, mobile dialog, short title rejection, contra initial vote. **Good** |

### Missing Test Coverage

| # | Gap | Priority | Rationale |
|---|-----|----------|-----------|
| T1 | `useVoteStream` hook -- no unit test for SSE connection, reconnection, or Map updates | High | Core real-time infrastructure is untested |
| T2 | E2E: SSE live updates (two browser sessions, one votes, other sees update) | High | The primary value of SSE is untested end-to-end |
| T3 | `submit-suggested` route -- no test at all (deadline bypass bug, missing SSE emission) | High | Contains two bugs; completely untested |
| T4 | `SuggestProposalsButton` -- no unit or E2E test for the AI suggestion workflow | Medium | Complex multi-step UI flow with no coverage |
| T5 | `useProposalForm` similarity debounce -- no test for timer cleanup on unmount | Medium | Potential memory leak identified but untested |
| T6 | `getProjectProposals` query function -- no unit test | Low | SQL join logic; covered indirectly by E2E |
| T7 | `removeVote` SSE emission after deadline -- edge case interaction untested | Low | Covered by deadline check test, but SSE emission path not verified |
| T8 | Proposal form `aria-describedby` and screen reader announcements | Low | Accessibility regressions not caught by any test |

---

## 6. Ideator Comparison

### Features Ideate Already Does Better

| Feature | Ideate | Ideator |
|---------|--------|---------|
| **Real-time voting** | SSE streaming via `useVoteStream` | None -- page reload required |
| **Vote removal** | Toggle pattern (click same vote to un-vote) | Only vote-change (pro <-> contra), no un-vote |
| **Inline voting** | Vote buttons in accordion trigger (no expand needed) | Must expand accordion to see vote buttons |
| **Multi-expand** | `type="multiple"` accordion | `type="single"` -- only one proposal visible |
| **Accessibility** | `aria-pressed`, `role="group"`, count in labels | Basic `aria-label` only, no `aria-pressed` |
| **RBAC** | Four roles (admin/manager/member/viewer) | None |
| **CSRF protection** | All server actions + API routes | None |
| **Proposal deletion** | Confirmation dialog, RBAC-gated | Not available |
| **Mobile keyboard** | `use-keyboard-inset` safe area handling | None |
| **Comment polling** | Smart polling only when sheet is open | No polling |
| **Vote bar scaling** | `maxTotalVotes` normalization across all proposals | Fixed per-proposal scale |

### Features Worth Porting from Ideator

#### 6.1 Center-Anchored Vote Bar (Medium Priority)

**Location:** `/home/dc/work/ideator/src/components/ui/ProposalAccordion.tsx:38-58`

Ideator uses a center-origin CSS gradient: red grows leftward from center, green grows rightward. This visually represents opposition (pro vs. contra) rather than just activity volume.

```typescript
// Ideator approach
const greenWidth = (upvotes / scale) * 50;  // max 50% right of center
const redWidth = (downvotes / scale) * 50;   // max 50% left of center

background: linear-gradient(to right,
  transparent 0%,
  transparent ${50 - redWidth}%,
  rgba(239,68,68,0.15) ${50 - redWidth}%,
  rgba(239,68,68,0.15) 50%,
  rgba(34,197,94,0.15) 50%,
  rgba(34,197,94,0.15) ${50 + greenWidth}%,
  transparent ${50 + greenWidth}%,
  transparent 100%)
```

**Current Ideate approach:** Two separate `<div>` elements growing from opposite edges. Functionally correct but less semantically expressive.

**Recommendation:** Consider as a design option. The center-anchored bar better communicates the "tug of war" nature of voting. Subjective UX preference -- could A/B test.

#### 6.2 Delayed-Glow Attention Pattern (Low Priority)

**Location:** `/home/dc/work/ideator/src/components/project-description-toggle.tsx`

After 2.8 seconds of page load, a button gets an orange pulse ring (`animate-pulse ring-2 ring-orange-400/70`) to draw first-time users' attention. Stops permanently after first click.

Ideate has no equivalent attention-drawing pattern. Could be applied to the "New Proposal" button or the project description toggle.

#### 6.3 Similarity Gradient Bar in Match Cards (Low Priority)

**Location:** `/home/dc/work/ideator/src/components/proposal-form.tsx:270-277`

Each similar proposal card shows a green gradient fill proportional to the similarity score:
```tsx
background: linear-gradient(90deg,
  rgba(16,185,129,0.2) 0%,
  rgba(16,185,129,0.25) ${pct}%,
  transparent ${pct}%)
```

Ideate's similarity warnings use text-only display (`"82% similar"`). The gradient bar adds visual scanability.

---

## 7. Bugs Found

| # | Bug | Severity | Location | Description |
|---|-----|----------|----------|-------------|
| B1 | **`submit-suggested` skips deadline check** | High | `api/proposals/submit-suggested/route.ts` | The route does not call `isDeadlinePassed()` before inserting proposals and votes. Users can submit AI suggestions after a project deadline closes. The regular `createProposal` action checks this at line 85 |
| B2 | **`submit-suggested` skips SSE emission** | Medium | `api/proposals/submit-suggested/route.ts:79-83` | Votes inserted here never call `emitVoteChange`. Other users' live vote bars won't reflect these proposals until page reload |
| B3 | **SSE keepalive interval leak** | Low | `api/votes/stream/route.ts:64-66` | `cancel()` calls `unsubscribe()` but doesn't `clearInterval(keepalive)`. The interval continues running until it throws on the closed controller |
| B4 | **`timerRef` not cleared on unmount** | Low | `use-proposal-form.ts:74-78` | The similarity debounce timer is not cancelled on component unmount. Could cause `setSimilarMatches` / `setCheckingSimilarity` calls on unmounted components |
| B5 | **Redundant `warnings` filter** | Trivial | `use-proposal-form.ts:86` | `similarMatches` is already filtered at `> 40` on line 61; the `warnings` computation filters again identically |

---

## 8. Prioritized Recommendations for Sprint 27

### P0 -- Bug Fixes (do first)

1. **Add deadline check to `submit-suggested` route** (B1)
   - Add `isDeadlinePassed(body.projectId)` check before the insert loop
   - Return 400 if deadline has passed
   - Estimated: 15 min

2. **Add SSE emission to `submit-suggested` route** (B2)
   - Import `emitVoteChange` and call `emitVoteUpdate` after each vote insert
   - Estimated: 15 min

3. **Fix keepalive interval leak in SSE `cancel()`** (B3)
   - Move `keepalive` declaration above `start()` so both `abort` and `cancel` can clear it
   - Estimated: 10 min

### P1 -- Accessibility Fixes

4. **Add `aria-label` to `SuggestionCard` vote buttons** (A5)
   - Add `aria-label={t("vote.pro")}` / `aria-label={t("vote.contra")}` to the ThumbsUp/ThumbsDown buttons
   - Estimated: 5 min

5. **Add loading indicator to `VoteButtons`** (A1)
   - Show a small spinner or sr-only "Loading" text when `isPending`
   - Estimated: 15 min

6. **Add `min-h-[44px]` to vote buttons** (A2)
   - Match the pattern already used by the discussion sheet trigger
   - Estimated: 5 min

7. **Add `role="alert"` to similarity warnings** (A3)
   - Wrap the warnings container in an `aria-live="polite"` region
   - Estimated: 5 min

### P2 -- SSE Robustness

8. **Add exponential backoff to `useVoteStream`** (S2)
   - Start at 1s, double on each failure, cap at 30s, reset on successful message
   - Estimated: 20 min

9. **Clear `timerRef` on unmount in `useProposalForm`** (B4)
   - Add cleanup return to the effect or add unmount guard
   - Estimated: 5 min

### P3 -- Test Coverage

10. **Add unit tests for `submit-suggested` route** (T3)
    - Test deadline enforcement (after fix), CSRF, RBAC, SSE emission, happy path
    - Estimated: 1 hour

11. **Add E2E test for SSE live updates** (T2)
    - Two browser contexts: one votes, the other verifies live count update
    - Estimated: 1 hour

12. **Add `useVoteStream` hook test** (T1)
    - Mock EventSource, verify Map updates, reconnection behavior
    - Estimated: 45 min

### P4 -- UX Enhancements (if time permits)

13. **Port center-anchored vote bar from Ideator**
    - Replace two-div approach with single CSS gradient
    - Estimated: 30 min

14. **Remove unused `is_negative_initiative` column or implement it**
    - Either drop via migration or add a "This eliminates something" toggle to the proposal form with visual differentiation
    - Estimated: 2 hours (implement) or 15 min (remove)

15. **Hardcoded English toast in `SuggestProposalsButton`**
    - `suggest-proposals.tsx:131`: `` `${data.created} proposal(s) added` `` should use `t()`
    - Estimated: 5 min

---

## Appendix: File Inventory

| File | Category | Purpose |
|------|----------|---------|
| `src/db/schema.ts` | Schema | `proposals` and `votes` table definitions |
| `src/app/projects/[id]/proposals/actions.ts` | Server Actions | `createProposal`, `deleteProposal`, `castVote`, `removeVote` |
| `src/app/api/votes/stream/route.ts` | API Route | SSE endpoint for live vote updates |
| `src/app/api/proposals/similarity/route.ts` | API Route | AI similarity check (LLM + Jaccard fallback) |
| `src/app/api/proposals/suggest/route.ts` | API Route | AI brainstorm suggestions |
| `src/app/api/proposals/submit-suggested/route.ts` | API Route | Persist AI suggestions as real proposals |
| `src/components/vote-buttons.tsx` | Component | Pro/Contra toggle buttons with ARIA |
| `src/components/proposal-list.tsx` | Component | Sorted list with live vote bars |
| `src/components/proposal-form.tsx` | Component | Dialog (mobile) + inline (desktop) form |
| `src/components/use-proposal-form.ts` | Hook | Form state + similarity debounce |
| `src/components/suggest-proposals.tsx` | Component | AI suggestion dialog + vote selection |
| `src/lib/vote-events.ts` | Lib | In-process pub-sub for SSE |
| `src/lib/use-vote-stream.ts` | Hook | SSE client + Map of live vote counts |
| `src/lib/rbac.ts` | Lib | Role permissions matrix |
| `src/lib/notifications.ts` | Lib | Debounced email notifications |
| `tests/unit/vote-actions.test.ts` | Unit Test | castVote, removeVote, deleteProposal |
| `tests/unit/proposals.test.ts` | Unit Test | createProposal |
| `tests/unit/vote-events.test.ts` | Unit Test | subscribeVotes / emitVoteChange |
| `tests/unit/vote-buttons.dom.test.tsx` | Unit Test | VoteButtons JSDOM |
| `tests/unit/proposal-list.dom.test.tsx` | Unit Test | ProposalList JSDOM |
| `tests/e2e/voting.test.ts` | E2E Test | Playwright voting flows |
| `tests/e2e/proposal-creation.test.ts` | E2E Test | Playwright proposal creation flows |
