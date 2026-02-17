# Sprint 26 Comments/Discussion Analysis (Codex)

Date: 2026-02-17 (UTC)
Analyst: Codex
Scope: Ideate comments/discussion feature only, analyzed independently (did not read `docs/sprint26-analysis-claude.md`).

## 1. Current Comment-Related Files

### Core feature path (DB -> queries -> actions -> UI)
- `drizzle/0005_project_comments.sql`
- `src/db/schema.ts`
- `src/db/queries.ts`
- `src/app/projects/[id]/queries.ts`
- `src/app/projects/[id]/proposals/comment-actions.ts`
- `src/components/comment-thread.tsx`
- `src/components/discussion-sheet.tsx`
- `src/components/project-comments.tsx`
- `src/components/proposal-list.tsx`
- `src/lib/use-comment-poll.ts`
- `src/app/projects/[id]/page.tsx`

### Cross-cutting/comment-adjacent files
- `src/lib/rbac.ts`
- `src/lib/audit.ts`
- `src/lib/notifications.ts`
- `src/lib/translations/en.ts`
- `src/lib/translations/ro.ts`
- `src/app/dashboard/queries.ts`
- `src/app/dashboard/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/projects/[id]/export/route.ts`
- `src/lib/export.ts`

### Test coverage files read
- `tests/unit/comment-actions.test.ts`
- `tests/unit/comment-thread.test.ts`
- `tests/unit/use-comment-poll.dom.test.ts`
- `tests/e2e/comments.test.ts`
- `tests/e2e/project-detail.test.ts`

## 2. Per-File Assessment

### `drizzle/0005_project_comments.sql`
- Good: adds project-level comments and CHECK constraint enforcing exactly one target (`proposal_id` xor `project_id`).
- Risk: does not enforce `parent_id` referential integrity; orphan replies remain possible.

### `src/db/schema.ts`
- Good: unified `comments` table supports proposal and project contexts.
- Gap: schema lacks the XOR check present in migration. App relies on migration SQL, not schema-level declaration.
- Gap: no FK on `parentId` to `comments.id`.

### `src/db/queries.ts`
- Good: dedicated project-comment fetch with joined author info and stable order.
- Gap: only flat list; no server-side tree validation or depth limits.

### `src/app/projects/[id]/queries.ts`
- Good: proposal comments loaded in bulk, grouped per proposal.
- Gap: `parentId` is fetched but not used for true threading in UI.
- Risk: query uses string-built `IN (...)` SQL fragments; works, but harder to maintain than `inArray`.

### `src/app/projects/[id]/proposals/comment-actions.ts`
- Good: CSRF, auth, RBAC, deadline gate, zod validation, audit logging, revalidation.
- Good: supports both proposal and project comments plus optional `parentId`.
- Gap: no validation that `parentId` exists or belongs to same proposal/project.
- Gap: notifications are fire-and-forget (not awaited) and proposal-only; project-level comments do not notify.
- Risk: broad catch returns generic error, reducing diagnosability.

### `src/components/comment-thread.tsx`
- Good: modern chat-bubble UX, keyboard submit, multiline support, optimistic append, new-message indicator.
- Critical gap: `buildCommentTree` only sorts chronologically; there is no threaded rendering despite `parentId` in data model.
- Gap: optimistic comments can briefly duplicate/flash after refresh (append then server refresh reconciliation).
- Gap: no reply affordance in UI even though schema/action/tests reference threading.

### `src/components/discussion-sheet.tsx`
- Good: clean proposal discussion entry point with comment count.
- Gap: `projectId` prop is unused (can mislead future maintainers).
- Gap: polling runs globally while component mounted; no sheet-open state optimization.

### `src/components/project-comments.tsx`
- Good: dedicated project-level thread section.
- Gap: hard height (`min(400px,60vh)`) may still feel cramped on small-height devices/keyboard-open states.

### `src/components/proposal-list.tsx`
- Good: discussion trigger integrated with vote controls.
- Gap: passes static comment snapshot from server render; freshness depends on polling refresh only.

### `src/lib/use-comment-poll.ts`
- Good: visibility-aware polling and cleanup.
- Gap: fixed interval polling (`15s`) is network-heavy at scale; no backoff/jitter/user activity heuristics.
- Gap: no opt-in to disable polling when discussion UI is closed.

### `src/lib/notifications.ts`
- Good: owner notifications for proposal votes/comments with debounce.
- Gap: in-memory debounce map is per-process; not shared across instances/restarts.
- Gap: no notification for project-level comment threads.

### `src/lib/rbac.ts`
- Good: clear read/create separation for comments, viewer read-only.
- Gap: no separate reply/moderation permissions (future governance need).

### `src/lib/audit.ts`
- Good: includes `comment` and `project_comment` actions.
- Gap: no distinction for reply vs top-level comment.

### `src/lib/translations/en.ts`, `src/lib/translations/ro.ts`
- Good: basic comment/discussion strings present.
- Gap: missing reply/threading strings for actual nested UX.

### Dashboard/Admin/Export files
- `src/app/dashboard/queries.ts`, `src/app/dashboard/page.tsx`: comment stats/activity present, but project comment counting relies on `comments.project_id`, so proposal comments can be underrepresented in some dashboard contexts.
- `src/app/admin/page.tsx`: only global comment count displayed, no moderation workflow.
- `src/app/api/projects/[id]/export/route.ts`, `src/lib/export.ts`: exports include proposal comments, not project-level discussion comments (data omission).

## 3. Live Tests (`curl`) Against `https://idea.surmont.co/`

Test time: 2026-02-17 00:11:53 UTC

### Commands and observed behavior
1. `curl -D - https://idea.surmont.co/`
- Result: `HTTP/2 200`
- Includes landing content with discussion marketing copy ("Discussions", threaded comments messaging).

2. `curl https://idea.surmont.co/api/health`
- Result JSON:
```json
{"status":"healthy","timestamp":"2026-02-17T00:11:53.304Z","database":"ok","version":"0.1.0"}
```

3. `curl -D - https://idea.surmont.co/projects`
- Result: `HTTP/2 307`
- Redirect target: `/auth/login?redirect=%2Fprojects`

4. `curl -L https://idea.surmont.co/projects`
- Result: login page HTML (`Sign in to Ideate`), redirect param retained.

### Interpretation
- Publicly reachable checks confirm healthy app and auth gating.
- Comment UI endpoints on project pages are not directly curl-testable without authenticated session/cookies and CSRF form flow.

## 4. Ideator Messenger Comparison (`/home/dc/work/ideator`)

Compared files:
- `app/actions/comments.ts`
- `src/components/proposal-discussion-sheet.tsx`
- `src/components/proposal-list.tsx`
- `app/(app)/projects/[id]/page.tsx`
- `src/db/schema.ts`

### What Ideate already exceeds
- Better security posture (CSRF + RBAC + audit + deadline checks).
- Better domain model (project-level comments + proposal-level comments in one table).
- Better tests and structured server-action flow.

### Messenger-like features in Ideator worth porting/refining
- Timestamp behavior: hover-reveal timestamp in bubbles (cleaner visual noise control).
- Avatar image support (`AvatarImage`) where available, fallback initials second.
- Sheet header microcopy oriented as team chat context.
- Discussion trigger visual treatment more explicit as "conversation entry".

### Features Ideator does not have (and should not regress to)
- No CSRF enforcement in comment action.
- Weaker validation and permission model.
- Less robust comment target model (proposal-centric legacy fields).

## 5. Mobile Concerns

1. Threading absent despite threaded schema.
- On mobile, flat chronology becomes hard to follow in active discussions.

2. Composer + viewport constraints.
- `h-[min(400px,60vh)]` and fixed sheet heights can conflict with virtual keyboard and safe-area behavior on smaller devices.

3. Poll refresh side effects.
- Repeated `router.refresh()` while typing can feel jumpy on mobile networks.

4. Tap target density in proposal row.
- Vote controls + discussion button in one compact row can become crowded around small widths.

5. New-message indicator without read anchoring.
- Indicator appears, but no per-thread unread marker or anchor persistence after navigation.

## 6. Prioritized Fixes

### P0 (Sprint 26 must-do)
1. Implement actual threaded rendering in `CommentThread` using `parentId` hierarchy, with reply action UI.
2. Validate `parentId` server-side: exists, same target scope, no cross-project/proposal linking.
3. Add regression tests for nested replies in both unit and E2E (depth-2 at minimum).

### P1 (High value)
1. Replace unconditional polling with "poll only when discussion visible/open" + activity-aware interval.
2. Support avatar image URLs in comment bubble UI.
3. Include project-level comments in export pipeline (API + CSV/HTML).

### P2 (Quality/scale)
1. Move notification debounce to durable/shared storage (DB or cache) for multi-instance correctness.
2. Add reply-specific audit action and optional moderation metadata.
3. Refactor proposal comment query `IN (...)` to safer composable patterns (`inArray`) for maintainability.

## 7. Summary

Current implementation is solid on security and baseline UX, but the biggest functional mismatch is that the system stores threaded metadata (`parentId`) without rendering real threads. Sprint 26 should center on turning comments into true threaded discussions, then tightening mobile behavior and reducing polling overhead.
