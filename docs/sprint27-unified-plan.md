# Sprint 27 Unified Plan — Voting & Proposals UX

**Issue:** #48
**Sources:** `docs/sprint27-analysis-claude.md` (Claude Opus 4.6), `docs/sprint27-analysis-codex.md` (Codex)
**Budget:** ~50 Claude Code turns

---

## Analysis Summary

Both reports independently audited the same codebase and converged on most findings. Key agreements and disagreements are noted below.

### Strong Agreement

| Finding | Claude | Codex |
|---------|--------|-------|
| `submit-suggested` route skips deadline check | B1 (High) | P0 #2 |
| `submit-suggested` route skips SSE emission + notifications | B2 (Medium) | P1 #6 |
| SSE keepalive interval leak in `cancel()` | B3 (Low) | — (not flagged) |
| `userVote` not updated via SSE — stale `aria-pressed` | S4 (Medium) | Per-file note on `proposal-list.tsx` |
| Hardcoded English toast in `suggest-proposals.tsx` | P4 #15 | P2 #8 |
| `isNegativeInitiative` unused | Noted | P1 #5 |
| Vote buttons missing WCAG touch targets | A2 (Medium) | Mobile concerns section |
| Missing tests for `submit-suggested` and SSE live updates | T2, T3 (High) | — (implicit) |

### Disagreements / Unique Findings

| Finding | Source | Resolution |
|---------|--------|------------|
| **Vote mutations trust client `projectId`** — Codex flags this as P0; Claude does not mention it | Codex | **Include as Goal 1.** Server-side project-id resolution prevents deadline-check bypass via spoofed `projectId`. Real security fix. |
| **Duplicate detection scoped to paginated slice** — Codex flags as P0; Claude does not mention it | Codex | **Defer.** Similarity check is advisory only (warns, never blocks). Low real-world impact since most projects have <50 proposals, well within a single page. Not worth the query complexity this sprint. |
| **Replace in-memory event bus with Redis** — Codex flags as P1 | Codex | **Defer.** Both reports agree the app targets single-instance SQLite deployment. Claude explicitly marks this acceptable-by-design (S5). Not sprint scope. |
| **Wire `isNegativeInitiative` end-to-end** — Codex flags as P1 | Codex | **Defer.** Non-trivial design work (UI, AI prompts, visual treatment). Not in #48 scope. |
| **Center-anchored vote bar from ideator** — Claude suggests as P4 | Claude | **Include as Goal 6.** Fits #48's "vote bar animations" scope and is a contained visual improvement. |
| **Suggestion card `aria-label` missing** — Claude flags as A5 (High) | Claude | **Include in Goal 4.** Quick accessibility fix. |
| **Similarity interception modal from ideator** — Codex port candidate | Codex | **Defer.** Major UX change. Current inline warnings are functional. |

---

## Goals (max 10)

### Goal 1 — Fix `castVote`/`removeVote` project-id integrity

**What:** Resolve the proposal's `projectId` server-side instead of trusting the client-supplied value. Run deadline checks against the authoritative project.

**Why:** Client can currently supply an arbitrary `projectId`, bypassing deadline enforcement for a different project.

**Files:** `src/app/projects/[id]/proposals/actions.ts`

**Test:** Unit test in `tests/unit/vote-actions.test.ts` — vote on proposal with wrong `projectId` still checks correct deadline.

---

### Goal 2 — Fix `submit-suggested` route: deadline + SSE + notifications

**What:**
- Add `isDeadlinePassed()` check before inserting proposals (B1).
- Call `emitVoteUpdate()` after each vote insert so SSE propagates (B2).
- Use `t()` for the success toast instead of hardcoded English string.

**Why:** This route is the only mutation path that bypasses both deadline enforcement and real-time propagation.

**Files:** `src/app/api/proposals/submit-suggested/route.ts`, `src/components/suggest-proposals.tsx`

**Test:** New unit test `tests/unit/submit-suggested.test.ts` — deadline rejection, SSE emission, happy path.

---

### Goal 3 — SSE robustness: keepalive leak + exponential backoff

**What:**
- Fix `cancel()` in SSE route to also clear the keepalive interval (B3).
- Add exponential backoff to `useVoteStream` reconnect: 1s initial, 2x per failure, cap 30s, reset on success (S2).
- Clear similarity debounce `timerRef` on unmount in `useProposalForm` (B4).

**Why:** Prevents interval leaks server-side and stops the client from hammering the server during outages.

**Files:** `src/app/api/votes/stream/route.ts`, `src/lib/use-vote-stream.ts`, `src/components/use-proposal-form.ts`

**Test:** Existing `tests/unit/vote-events.test.ts` still passes. Manual verification of backoff via console logs during dev.

---

### Goal 4 — Accessibility fixes (vote buttons, suggestion cards, similarity warnings)

**What:**
- Add `min-h-[44px]` to vote buttons for WCAG 2.5.5 touch targets (A2).
- Add loading spinner / sr-only text to vote buttons when `isPending` (A1).
- Add `aria-label` to suggestion card ThumbsUp/ThumbsDown/Skip buttons (A5).
- Wrap similarity warnings in `aria-live="polite"` region (A3).

**Why:** Four quick accessibility wins. A5 is the highest severity — icon-only buttons with no screen reader text.

**Files:** `src/components/vote-buttons.tsx`, `src/components/suggest-proposals.tsx`, `src/components/proposal-form.tsx`

**Test:** Update `tests/unit/vote-buttons.dom.test.tsx` — assert `min-h-[44px]` class and spinner presence when pending.

---

### Goal 5 — Vote animation: instant optimistic feedback

**What:** Add optimistic count update + button scale animation on vote cast. When a user taps vote:
1. Immediately update local count (+1/-1) and flip `aria-pressed` before server round-trip.
2. Apply a brief CSS scale pulse (`scale-110` -> `scale-100`, ~150ms) on the vote button.
3. On server response, reconcile with authoritative counts; on error, rollback.

**Why:** Issue #48 exit criteria: "voting feels snappy and satisfying." Current UX waits for server round-trip before any visual feedback.

**Files:** `src/components/vote-buttons.tsx`, `src/components/proposal-list.tsx`

**Test:** E2E test `tests/e2e/voting.test.ts` — verify count changes immediately on click (before server settles). DOM test — verify scale class is applied.

---

### Goal 6 — Center-anchored vote bar with smooth transitions

**What:** Replace the two-div left/right vote bar with a single-element CSS gradient anchored at center. Green grows right from midpoint, red grows left. Keep `transition-all duration-300` for live SSE updates.

**Why:** Better visual metaphor for pro-vs-contra tug of war. Ported from ideator where it tested well.

**Files:** `src/components/proposal-list.tsx`

**Test:** Update `tests/unit/proposal-list.dom.test.tsx` — assert gradient style values instead of two separate div widths.

---

### Goal 7 — Proposal card polish: expand/collapse animation

**What:** Add smooth height animation to accordion expand/collapse using Radix `data-[state=open]` / `data-[state=closed]` with CSS `grid-template-rows: 0fr` -> `1fr` transition trick (or `animate-accordion-down` / `animate-accordion-up` if already configured in tailwind).

**Why:** Current expand/collapse is instant and jarring. Smooth animation is part of #48's "animations" scope.

**Files:** `src/components/proposal-list.tsx`, possibly `tailwind.config.ts` if keyframes needed

**Test:** Visual check. E2E test can assert `data-state="open"` attribute after click.

---

### Goal 8 — Mobile touch UX hardening

**What:**
- Increase tap spacing between vote buttons and discussion trigger in the proposal trigger row on small screens.
- Ensure similarity warnings in proposal form don't push submit below fold — add `max-h` with scroll on the warnings container.
- Verify suggestion card buttons have adequate spacing on mobile widths.

**Why:** Both reports flag mobile action density as a concern. #48 specifically calls out "mobile touch UX for voting."

**Files:** `src/components/proposal-list.tsx`, `src/components/proposal-form.tsx`, `src/components/suggest-proposals.tsx`

**Test:** E2E mobile-viewport tests in `tests/e2e/voting.test.ts` and `tests/e2e/proposal-creation.test.ts` — verify buttons are tappable without overlap.

---

### Goal 9 — Test coverage: SSE live updates E2E + useVoteStream unit

**What:**
- E2E test (T2): Two Playwright browser contexts on the same project. Context A votes; Context B asserts live count update without page reload.
- Unit test (T1): Mock `EventSource` in Vitest, verify `useVoteStream` Map updates, reconnection behavior, and cleanup on unmount.

**Why:** The primary value proposition of SSE (real-time collaboration) has zero test coverage.

**Files:** `tests/e2e/voting.test.ts`, new `tests/unit/use-vote-stream.test.ts`

**Test:** The tests themselves are the deliverable.

---

### Goal 10 — Cleanup: redundant filter + remove dead code

**What:**
- Remove redundant `warnings` filter in `useProposalForm` (B5) — `similarMatches` is already filtered at `> 40`.
- Audit and remove or annotate `isNegativeInitiative` column (leave schema, add `// TODO: wire in future sprint` comment — no migration churn).

**Why:** Minor code hygiene. Both reports identified the redundant filter.

**Files:** `src/components/use-proposal-form.ts`, `src/db/schema.ts`

**Test:** Existing tests pass.

---

## Execution Order

| Phase | Goals | Est. Turns |
|-------|-------|------------|
| **Bug fixes** | 1, 2, 3 | ~12 |
| **Accessibility** | 4 | ~4 |
| **Vote UX** | 5, 6 | ~10 |
| **Animations + Mobile** | 7, 8 | ~8 |
| **Tests** | 9 | ~10 |
| **Cleanup** | 10 | ~2 |
| **Buffer / fixes** | — | ~4 |
| **Total** | | **~50** |

---

## Out of Scope (deferred)

- Replace in-memory event bus with Redis pub/sub (both reports agree: single-instance deployment is fine)
- Wire `isNegativeInitiative` end-to-end (needs design decisions beyond #48)
- Similarity interception modal from ideator (major UX change, not in #48 scope)
- Expand duplicate detection to full proposal catalog (advisory-only feature, low impact)
- DB check constraint for vote value (app-level validation is sufficient)
