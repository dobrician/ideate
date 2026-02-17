# Sprint 26 Analysis: Comments & Discussion Feature

**Sprint:** 26 | **Issue:** #47 | **Date:** 2026-02-17
**Analyst:** Claude Opus 4.6 | **Status:** 6/6 Goals Complete
**Project stats:** 718 tests | 98.59% stmt / 93.15% branch / 100% func / 99.19% line

---

## 1. Current Comment Implementation

### File Inventory

| File | Lines | Role |
|------|------:|------|
| `src/components/comment-thread.tsx` | 277 | Core UI: bubbles, avatars, form, scroll, optimistic updates |
| `src/components/project-comments.tsx` | 37 | Wrapper for project-level discussion section |
| `src/components/discussion-sheet.tsx` | 55 | Side-sheet wrapper for proposal-level comments |
| `src/lib/use-comment-poll.ts` | 50 | Polling hook with visibility API awareness |
| `src/app/projects/[id]/proposals/comment-actions.ts` | 122 | Server action: validate, insert, audit, notify |
| `src/db/queries.ts` | 47 | `getProjectComments()` with user join |
| `src/db/schema.ts` (L118-137) | 20 | Comments table: dual FK (proposal/project), threading |
| `drizzle/0005_project_comments.sql` | 40 | Migration (Sprint 16) with XOR constraint |
| `src/lib/translations/en.ts` | 8 keys | i18n: `comments.*`, `time.*` |
| `src/lib/translations/ro.ts` | 8 keys | Romanian translations |
| `tests/unit/comment-actions.test.ts` | 221 | 14 tests: auth, validation, deadline, audit |
| `tests/unit/comment-thread.test.ts` | 192 | 22 tests: tree, timeAgo, initials, color |
| `tests/unit/use-comment-poll.dom.test.ts` | 95 | 6 tests: interval, visibility, cleanup |
| `tests/e2e/comments.test.ts` | 174 | 7 scenarios: submit, bubbles, sheet, keyboard |
| **Total** | **~1,347** | |

### Architecture

```
ProjectPage (server component, fetches comments via getProjectComments)
  |
  +-- ProjectComments (client)
  |     +-- useCommentPoll()          --> router.refresh() every 15s
  |     +-- CommentThread
  |           +-- ScrollArea with viewport tracking
  |           +-- ChatBubble[] (sorted oldest-first, grouped by user)
  |           +-- New-message indicator (floating pill)
  |           +-- Form: Textarea + Send button
  |                 +-- useActionState(addComment)
  |                 +-- useOptimistic (instant feedback)
  |                 +-- CSRF token (hidden input)
  |
  +-- ProposalList (client)
        +-- ProposalItem
              +-- DiscussionSheet (Radix Sheet, right-side slide-out)
                    +-- useCommentPoll()
                    +-- CommentThread (shared component, same as above)
```

**Data flow:**
1. Server component fetches comments from SQLite via Drizzle ORM
2. Props passed to client components
3. `useCommentPoll()` calls `router.refresh()` every 15s, triggering server re-render
4. `useOptimistic` shows new comments instantly before server confirmation
5. `addComment` server action validates (Zod), checks RBAC + deadline, inserts, audits, notifies

### Database Schema

```sql
comments (
  id           TEXT PRIMARY KEY,
  proposal_id  TEXT REFERENCES proposals(id) ON DELETE CASCADE,
  project_id   TEXT REFERENCES projects(id) ON DELETE CASCADE,
  parent_id    TEXT,                              -- threading (unused in UI)
  content      TEXT NOT NULL,
  created_at   INTEGER DEFAULT (unixepoch()),
  updated_at   INTEGER DEFAULT (unixepoch()),
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  CHECK (proposal_id IS NOT NULL OR project_id IS NOT NULL)  -- XOR
)
```

Key points: dual-scope (proposal or project), threading ready (`parent_id`), cascade deletes, soft-null user refs.

---

## 2. UX Assessment

### Messenger Feel

The implementation achieves a convincing messenger aesthetic:

**Bubble layout** -- Own messages right-aligned with `flex-row-reverse`, others left-aligned. Directional corner notches (`rounded-tr-sm` for own, `rounded-tl-sm` for others) on top of a base `rounded-2xl`. Max width `85%` mobile / `75%` desktop prevents wall-of-text issues.

**Avatar grouping** -- Consecutive messages from the same user collapse: avatar shown only on the first message, a `w-6` spacer on subsequent ones, with `pt-2` gap between groups. Reduces visual noise in rapid conversations.

**Color-coded avatars** -- Deterministic hash function (`hash * 31 + charCode`) maps `userId` to 8 Tailwind colors (`bg-blue-600` through `bg-indigo-600`). Null users default to blue. Initials extracted from name (first letter of first 2 words).

**Timestamps** -- Relative format via `formatTimeAgo()` using i18n keys (`just now`, `5m ago`, `2h ago`, `3d ago`). Shown beside the username for first message in a group; smaller `text-[10px]` below subsequent messages.

**Empty state** -- Centered placeholder "No comments yet. Start the discussion!" with `text-muted-foreground`.

### What works well
- Bubble direction and coloring are immediately recognizable
- Avatar grouping is comparable to iMessage/WhatsApp
- Markdown rendered inline (`MarkdownRenderer simple` mode) allows formatted text without breaking layout
- The "You" label for own messages (localized) is a good touch

### Where it falls short
- No profile pictures -- always initials fallback, no `AvatarImage`. Ideator has `authorAvatarUrl` support
- No hover-reveal timestamps -- Ideator hides timestamps by default, shows on hover (`opacity-0 group-hover:opacity-100`), which is cleaner for dense threads
- No read receipts or delivery indicators
- No typing indicators
- No user presence (online/offline)
- `formatTimeAgo` has no "weeks ago" or "months ago" -- 30+ days still shows "30d ago"

---

## 3. Real-Time Updates

### Current Approach

**Mechanism:** Interval polling via `useCommentPoll()` hook

```typescript
// src/lib/use-comment-poll.ts
export function useCommentPoll(intervalMs = 15_000) {
  const router = useRouter();
  // setInterval -> router.refresh() every 15s
  // Pauses when document.hidden, resumes with immediate refresh
}
```

**Characteristics:**
- 15-second default interval (configurable per-caller)
- Page Visibility API: stops timer when tab hidden, immediate refresh + restart when tab returns
- Uses Next.js `router.refresh()` which triggers RSC re-render without losing client state
- Both `ProjectComments` and `DiscussionSheet` independently run polling
- No deduplication -- if both are mounted, two timers fire

### Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No SSE/WebSocket | 15s latency for new messages | Medium |
| No deduplication | Two polling timers if sheet + project comments both visible | Low |
| Full page refresh | `router.refresh()` re-fetches all server data, not just comments | Medium |
| No "since" parameter | Every poll fetches all comments, no incremental loading | Medium |
| No exponential backoff | Constant 15s even when idle for long periods | Low |
| No error handling | Poll failures silently ignored | Low |
| No stale detection | If server is slow, polls can stack up | Low |

### Recommendation

The polling approach is pragmatic for the current scale. For a future upgrade path:
1. **Short term:** Add a `since` timestamp parameter to fetch only new comments (reduce payload)
2. **Medium term:** Server-Sent Events (SSE) via a `/api/comments/stream` route
3. **Long term:** WebSocket for bidirectional real-time (typing indicators, presence)

---

## 4. Input UX

### Enter / Shift+Enter

```typescript
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    formRef.current?.requestSubmit();
  }
}
```

- **Enter** submits (via `requestSubmit()` for proper form validation)
- **Shift+Enter** and **Ctrl+Enter** insert newlines (browser default)
- E2E tested: both submit and newline paths verified

### Auto-Growing Textarea

```typescript
function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
  const ta = e.currentTarget;
  ta.style.height = "";                              // reset
  ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;  // grow up to 120px
}
```

- Min height: `44px` (touch-friendly)
- Max height: `120px` (~5 lines)
- `resize-none` prevents manual resize handle
- Resets to min on form clear after successful submit
- Handles `maxLength={2000}` (enforced client + server)

### Scroll Behavior

**Auto-scroll logic** in `useEffect([comments.length])`:
1. If new comments arrived AND user is near bottom (within 100px): auto-scroll to end
2. If new comments arrived AND user has scrolled up: show "New messages" floating pill
3. Clicking the pill scrolls to bottom and dismisses it
4. Initial mount: always scrolls to bottom

**Scroll detection:**
```typescript
function isNearBottom(el: Element, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}
```

### Assessment

The input UX is solid and matches modern messenger conventions. Minor issues:
- No character count indicator approaching the 2000 limit
- No markdown preview before submit
- No emoji picker
- The 120px max textarea could be slightly taller on desktop
- `requestSubmit()` relies on browser validation (`required`) for empty check -- no custom error message on empty submit attempt

---

## 5. Mobile Responsiveness

### Height Strategy

| Context | Mobile | Desktop |
|---------|--------|---------|
| Project comments | `h-[min(400px,60vh)]` | `sm:h-[min(400px,50vh)]` |
| Discussion sheet | `h-[calc(100dvh-8rem)]` | `sm:h-[calc(100vh-10rem)]` |
| Sheet width | `w-full` | `sm:max-w-lg` |

- Uses `100dvh` (dynamic viewport height) on mobile to account for browser chrome
- `env(safe-area-inset-bottom)` on the input area prevents iOS notch overlap
- Bubble max-width: `85%` mobile, `75%` desktop

### Touch Targets

- Send button: `44px x 44px` (meets WCAG 2.5.5 AAA)
- Textarea min-height: `44px` (meets minimum)
- Sheet trigger button: standard `size="sm"` (~36px, slightly under 44px target)

### What works
- The `dvh` unit is correct for mobile Safari where toolbar shows/hides
- Safe area inset handles notched devices
- ScrollArea within constrained height prevents layout shift
- Full-width sheet on mobile is the right pattern

### What could improve
- No landscape-specific adjustments
- Discussion sheet trigger button is smaller than recommended touch target
- No swipe-to-dismiss on the sheet (Radix Sheet supports this but it's not configured)
- No pull-to-refresh gesture for manual comment refresh on mobile

---

## 6. Test Coverage

### Summary

| Test File | Tests | Lines | What's Covered |
|-----------|------:|------:|----------------|
| `comment-actions.test.ts` | 14 | 221 | Auth, RBAC, validation, deadline, audit, threading, DB errors |
| `comment-thread.test.ts` | 22 | 192 | `buildCommentTree`, `formatTimeAgo`, `getInitials`, `avatarColor` |
| `use-comment-poll.dom.test.ts` | 6 | 95 | Interval, visibility pause/resume, cleanup, listener removal |
| `comments.test.ts` (E2E) | 7 | 174 | Send (button + Enter), empty reject, bubble layout, Shift+Enter, avatar, sheet |
| **Total** | **49** | **682** | |

### What's Well-Tested

- **Server action:** Full validation gauntlet (empty, too long, XOR, auth, RBAC, deadline past/future, threading, DB failure)
- **Pure functions:** `buildCommentTree` (empty, sort, null dates, immutability, stable sort), `formatTimeAgo` (all buckets + boundaries), `getInitials` (edge cases), `avatarColor` (null, determinism, distribution)
- **Polling hook:** Timer lifecycle, visibility API integration, cleanup on unmount
- **E2E flows:** Both submission methods, keyboard behavior, visual layout assertions

### Coverage Gaps

| Gap | Risk | Priority |
|-----|------|----------|
| **No render test for `CommentThread` component** | Visual regressions in bubble layout, form state, scroll behavior untested at component level | High |
| **No render test for `ChatBubble` component** | Own vs other styling, avatar visibility, timestamp rendering | High |
| **No optimistic update test** | Optimistic comment could appear wrong or not clear after server response | Medium |
| **No scroll-to-bottom test** | Auto-scroll and new-message indicator behavior untested | Medium |
| **No `ProjectComments` / `DiscussionSheet` integration test** | Wrappers could break without dedicated tests | Low |
| **No rate-limit or spam test** | Rapid submissions not tested | Low |
| **No concurrent user test (E2E)** | Two users commenting simultaneously untested | Low |
| **No large dataset test** | 100+ comments: performance, scroll behavior, rendering | Low |
| **No accessibility test** | ARIA labels, keyboard navigation through comments, screen reader | Medium |
| **No dark mode visual test** | Bubble colors in dark mode could have contrast issues | Low |
| **No network failure/retry test** | Optimistic UI behavior when server action fails | Medium |
| **No `MarkdownRenderer` XSS test in comment context** | Sanitization tested elsewhere but not specifically for comment content | Low |

---

## 7. Ideator Comparison

### Side-by-Side

| Feature | Ideate (Sprint 26) | Ideator |
|---------|-------------------|---------|
| **UI Surface** | Inline section + Sheet | Sheet only |
| **Real-time updates** | 15s polling + visibility API | None (revalidation only) |
| **Optimistic UI** | `useOptimistic` instant feedback | None (waits for server) |
| **Input type** | Auto-grow Textarea | Single-line Input (`h-11`) |
| **Keyboard submit** | Enter to send, Shift+Enter newline | None (click only) |
| **Scroll behavior** | Auto-scroll + "New messages" pill | None (static position) |
| **Bubble grouping** | Consecutive-user grouping | Every message standalone |
| **Avatar colors** | 8-color deterministic hash | No color coding |
| **Avatar images** | Initials only (no images) | Image + fallback support |
| **Timestamps** | Always visible, relative (i18n) | Hover-reveal, `date-fns` |
| **i18n** | English + Romanian | English only |
| **CSRF protection** | Token validation | None |
| **RBAC** | Role-based (viewers blocked) | None (auth only) |
| **Deadline enforcement** | Past-deadline blocks comments | None |
| **Audit logging** | Per-comment audit trail | None |
| **Email notifications** | Proposal owner notified (15min debounce) | None |
| **Markdown** | `MarkdownRenderer simple` | `MarkdownRenderer simple` |
| **Threading support** | Schema yes, UI no | Schema yes, UI no |
| **Safe area handling** | `env(safe-area-inset-bottom)` | None |

### Features Worth Porting from Ideator

1. **Avatar image support** -- Ideator's `AvatarImage` with URL fallback. Ideate has the `avatarUrl` field in the users table but `comment-thread.tsx` never passes it to the Avatar component. Low effort, high visual impact.

2. **Hover-reveal timestamps** -- Ideator's `opacity-0 group-hover:opacity-100` pattern is cleaner for dense threads. Shows metadata on demand rather than always. Could be an optional behavior alongside the current always-visible approach.

3. **Sheet description** -- Ideator includes `<SheetDescription>` ("Discuss this proposal with the team and keep decisions visible"), which provides helpful context. Ideate's `DiscussionSheet` has only a title.

4. **Comment count badge styling** -- Ideator's pill badge (`rounded-full text-xs font-semibold shadow-sm`) is more visually prominent than Ideate's plain parenthetical `({count})`.

### Features Ideate Already Surpasses Ideator

Ideate's comment system is substantially more advanced: real-time polling, optimistic UI, auto-grow textarea, enter-to-submit, scroll management, new-message indicators, avatar color coding, RBAC, CSRF, deadline enforcement, audit logging, notifications, and i18n. These features were built specifically in Sprint 26 and represent a generation ahead of Ideator's simpler implementation.

---

## 8. Prioritized Recommendations

### P0 -- Quick Wins (< 1 sprint)

1. **Add avatar image support**
   - Files: `comment-thread.tsx` (pass `avatarUrl` to `AvatarImage`)
   - The `users.avatarUrl` field exists but isn't used in comments
   - Estimated effort: 30 minutes

2. **Add `CommentThread` component render tests**
   - Files: new `tests/unit/comment-thread.dom.test.tsx`
   - Test: bubble direction (own vs other), avatar grouping, empty state, error display
   - Estimated effort: 2-3 hours

3. **Add character count indicator**
   - Files: `comment-thread.tsx` (show `{length}/2000` near textarea when > 1500)
   - Estimated effort: 30 minutes

### P1 -- Medium Effort (1-2 sprints)

4. **Incremental polling with `since` parameter**
   - Files: `queries.ts` (add `since` timestamp filter), `use-comment-poll.ts` (track last-seen timestamp), `comment-thread.tsx` (merge new comments)
   - Reduces payload from "all comments" to "only new since last poll"
   - Estimated effort: 4-6 hours

5. **Thread/reply UI**
   - Schema already supports `parentId`. UI needs: reply button per message, indented reply display, reply-to indicator
   - Files: `comment-thread.tsx` (major refactor of `buildCommentTree` + rendering)
   - Estimated effort: 8-12 hours

6. **Comment edit & delete**
   - Files: new server actions, `comment-thread.tsx` (context menu or edit button), migration for soft-delete
   - Requires RBAC: own-comments-only for members, any for admin
   - Estimated effort: 6-8 hours

7. **Optimistic update + scroll tests**
   - Files: new `tests/unit/comment-thread.dom.test.tsx`
   - Test: optimistic comment appears, clears after refresh, scroll-to-bottom behavior, new-message indicator
   - Estimated effort: 3-4 hours

### P2 -- Larger Investments (2+ sprints)

8. **Server-Sent Events (SSE) for real-time**
   - Replace polling with SSE endpoint: `/api/comments/stream?projectId=X`
   - Server pushes new comment events, client appends in real-time
   - Eliminates 15s latency entirely
   - Estimated effort: 12-16 hours

9. **Comment reactions (emoji)**
   - New `comment_reactions` table, emoji picker component, reaction display under bubbles
   - Estimated effort: 8-12 hours

10. **Pagination for large threads**
    - Currently loads all comments at once. Add cursor-based pagination with "load earlier" button
    - Critical if any project accumulates 100+ comments
    - Estimated effort: 6-8 hours

11. **Accessibility audit**
    - ARIA roles for chat region, live region for new messages, keyboard navigation through comment list, focus management on submit
    - Estimated effort: 4-6 hours

### P3 -- Nice-to-Have

12. Typing indicators (WebSocket required)
13. Hover-reveal timestamps (port Ideator pattern)
14. Markdown preview toggle before submit
15. Pull-to-refresh gesture on mobile
16. Comment search/filter
17. Rate limiting on server action
18. Mention (@user) support with autocomplete

---

## Appendix: Sprint 26 Commit History

| Commit | Goal | Description |
|--------|------|-------------|
| `5d18dee` | 1 | Messenger-style comment bubbles with color-coded avatars |
| `101e61d` | 2 | Real-time comment polling with visibility-aware 15s refresh |
| `f1bf056` | 3 | Enter-to-submit, auto-grow textarea, optimistic comment UI |
| `a968510` | 4 | Scroll-to-bottom with new-messages indicator |
| `fc50110` | 5 | Mobile responsive messenger UX polish |
| `b690bc4` | 6 | Exhaustive unit + E2E tests for comments & polling |

## Appendix: Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| CSRF tokens | Implemented | `getCsrfTokenClient()` + `requireCsrfToken()` |
| RBAC | Implemented | `comment:create` permission; viewers blocked |
| Input validation | Implemented | Zod schema: length, XOR constraint |
| XSS prevention | Implemented | `MarkdownRenderer simple` sanitizes output |
| SQL injection | Prevented | Drizzle ORM parameterized queries |
| Deadline enforcement | Implemented | Past-deadline projects reject new comments |
| Audit trail | Implemented | Per-comment `logAudit()` with userId + action |
| Rate limiting | Missing | No server-side rate limit on comment creation |
