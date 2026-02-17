# Sprint 26 Unified Plan: Comments & Discussion Polish

**Sprint:** 26 | **Issue:** #47 | **Date:** 2026-02-17
**Sources:** `docs/sprint26-analysis-claude.md` (Claude Opus 4.6), `docs/sprint26-analysis-codex.md` (Codex)
**Budget:** ~50 Claude Code turns

---

## Analyst Agreement & Disagreement

### Both analysts agree on

- The comment system's security posture (CSRF, RBAC, audit, deadline enforcement) is strong and already surpasses Ideator
- Avatar images are supported in the DB (`users.avatarUrl`) but never rendered in comment bubbles -- low effort, high impact fix
- Polling is pragmatic at current scale but wastes resources when the discussion UI is closed
- `parentId` exists in schema and server action but the UI renders flat chronology only
- Mobile height constraints can conflict with virtual keyboards on small devices
- Test coverage has gaps at the component render level (`CommentThread`, `ChatBubble` rendering)
- Hover-reveal timestamps (Ideator pattern) would reduce visual noise in dense threads
- Project-level comments are missing from the export pipeline
- No character count indicator near the 2000-char limit

### Analysts disagree on

| Topic | Claude | Codex | Resolution |
|-------|--------|-------|------------|
| **Threading as Sprint 26 P0** | P1 (medium effort, 8-12h) | P0 (must-do this sprint) | **Defer.** Threading UI is a major refactor (~12h+) that exceeds budget. Schema + server action are ready; UI can be a Sprint 27 goal. |
| **`parentId` server validation** | Not flagged | P0 (validate exists, same scope) | **Include as lightweight goal.** Server-side guard is small and prevents bad data. |
| **Incremental polling (`since` param)** | P1 (4-6h) | Not mentioned directly | **Defer.** Useful but not user-visible. Prefer visible UX fixes within budget. |
| **Export gap (project comments)** | Not flagged | P1 | **Include.** Small fix, prevents data loss in exports. |
| **Notification debounce durability** | Not flagged | P2 | **Defer.** In-memory debounce is fine for single-instance SQLite deployment. |

---

## Goals (10 concrete, testable)

### Goal 1: Avatar image support in comment bubbles
- Pass `avatarUrl` through to `AvatarImage` in `comment-thread.tsx`
- Fallback to initials when no image URL exists (current behavior preserved)
- **Test:** unit test renders `<img>` when URL provided, initials when not

### Goal 2: Hover-reveal timestamps
- Default: hide per-message timestamps, show on hover via `group-hover:opacity-100`
- First message in a group still shows username + relative time
- Touch devices: tap to reveal (CSS `:active` or toggle state)
- **Test:** E2E assertion that timestamp is hidden by default, visible on hover

### Goal 3: CommentThread + ChatBubble component render tests
- New `tests/unit/comment-thread.dom.test.tsx`
- Cover: own vs other bubble direction, avatar grouping/collapse, empty state, error display, avatar image rendering
- Cover: optimistic comment appears immediately, clears flash after mock refresh
- **Test:** all new tests pass, no regressions in existing 49 comment tests

### Goal 4: Scroll and new-message indicator tests
- Test auto-scroll on new comment when near bottom
- Test "New messages" pill appears when scrolled up
- Test pill click scrolls to bottom
- **Test:** DOM-level assertions in `comment-thread.dom.test.tsx`

### Goal 5: `parentId` server-side validation
- In `comment-actions.ts`, when `parentId` is provided: verify it exists and belongs to the same `proposalId`/`projectId`
- Return validation error if orphan or cross-scope
- **Test:** unit tests for invalid `parentId` (nonexistent, wrong scope)

### Goal 6: Character count indicator
- Show `{length}/2000` below textarea when content exceeds 1500 chars
- At 2000, show in red/destructive color
- **Test:** E2E or unit test verifying indicator appears at threshold

### Goal 7: Smart polling -- only when discussion is visible
- `DiscussionSheet`: poll only while sheet is open (not while closed/mounted)
- Stop duplicate timers when both project comments and sheet are mounted
- **Test:** unit test confirms no interval fires when sheet is closed

### Goal 8: Include project comments in export
- Update `src/lib/export.ts` to include project-level discussion comments
- Render in both CSV and HTML export formats
- **Test:** unit test asserting project comments appear in export output

### Goal 9: Discussion sheet UX polish
- Add `SheetDescription` with contextual microcopy
- Improve discussion trigger button: comment count as pill badge (`rounded-full`) instead of parenthetical
- Ensure trigger meets 44px minimum touch target
- **Test:** E2E assertion for badge rendering and sheet description presence

### Goal 10: Mobile keyboard + safe-area hardening
- Audit and fix height calculations when virtual keyboard is open (use `visualViewport` API if needed)
- Ensure input area stays visible above keyboard on iOS Safari and Android Chrome
- Test landscape orientation doesn't break layout
- **Test:** E2E mobile viewport test (Playwright `--device` flag) with assertions on input visibility

---

## Execution Order & Dependencies

```
Phase 1 (parallel, no deps):
  Goal 1  Avatar images
  Goal 5  parentId validation
  Goal 6  Character count
  Goal 8  Export fix

Phase 2 (depends on Goal 1):
  Goal 2  Hover-reveal timestamps
  Goal 3  Component render tests (covers Goals 1+2 changes)
  Goal 4  Scroll/indicator tests

Phase 3 (depends on Phase 1):
  Goal 7  Smart polling
  Goal 9  Sheet UX polish

Phase 4 (final):
  Goal 10  Mobile hardening (test all prior changes on mobile viewports)
```

## Turn Budget Estimate

| Goal | Est. turns | Notes |
|------|--------:|-------|
| 1. Avatar images | 3 | Small component change + test |
| 2. Hover timestamps | 4 | CSS + touch fallback + test |
| 3. Render tests | 8 | Largest test-writing effort |
| 4. Scroll tests | 4 | DOM scroll mocking |
| 5. parentId validation | 3 | Server action guard + tests |
| 6. Char count | 2 | Small UI + test |
| 7. Smart polling | 4 | Hook refactor + tests |
| 8. Export fix | 3 | Query + format + test |
| 9. Sheet polish | 3 | UI tweaks + E2E |
| 10. Mobile hardening | 5 | Cross-device testing |
| **Buffer** | **~6** | Regressions, CI fixes |
| **Total** | **~45** | Within 50-turn budget |

---

## Deferred to Sprint 27+

- Threaded reply UI rendering (schema ready, UI is a major refactor)
- Incremental polling with `since` parameter
- SSE/WebSocket real-time upgrade
- Comment edit & delete
- Emoji reactions
- Typing indicators
- Markdown preview before submit
- Mention (@user) autocomplete
- Accessibility audit (ARIA live regions, keyboard nav)
- Rate limiting on comment server action
- Durable notification debounce (DB-backed)
