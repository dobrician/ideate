# Sprint 27 Analysis (Codex) — Voting & Proposals

Date: 2026-02-17 (UTC)

## Scope and Method
- Independently analyzed the voting/proposals implementation in `ideate` source.
- Did **not** read `docs/sprint27-analysis-claude.md`.
- Reviewed corresponding implementation in `/home/dc/work/ideator` for feature-port opportunities.
- Ran live checks with `curl` against `https://idea.surmont.co/`.

## Current Files (Voting/Proposals)
Primary files reviewed:
- `src/db/schema.ts`
- `src/app/projects/[id]/page.tsx`
- `src/app/projects/[id]/queries.ts`
- `src/app/projects/[id]/proposals/actions.ts`
- `src/app/projects/[id]/proposals/comment-actions.ts`
- `src/components/proposal-list.tsx`
- `src/components/vote-buttons.tsx`
- `src/components/proposal-form.tsx`
- `src/components/use-proposal-form.ts`
- `src/components/suggest-proposals.tsx`
- `src/components/discussion-sheet.tsx`
- `src/components/comment-thread.tsx`
- `src/lib/vote-events.ts`
- `src/lib/use-vote-stream.ts`
- `src/app/api/votes/stream/route.ts`
- `src/app/api/proposals/suggest/route.ts`
- `src/app/api/proposals/similarity/route.ts`
- `src/app/api/proposals/submit-suggested/route.ts`

Related behavior/tests reviewed:
- `src/lib/use-comment-poll.ts`
- `src/lib/notifications.ts`
- `tests/unit/proposals.test.ts`
- `tests/unit/vote-actions.test.ts`
- `tests/unit/vote-events.test.ts`
- `tests/unit/vote-buttons.dom.test.tsx`
- `tests/unit/proposal-list.dom.test.tsx`
- `tests/e2e/voting.test.ts`
- `tests/e2e/proposal-creation.test.ts`

## Per-File Assessment
- `src/db/schema.ts`
  - Good: proposal/vote/comment schema is clear, with composite PK for one vote per user per proposal.
  - Gap: `isNegativeInitiative` exists but is not wired through creation UI/actions.
  - Gap: no DB-level check constraint for vote value (`1/-1`) (currently app-level only).

- `src/app/projects/[id]/queries.ts`
  - Good: efficient aggregate vote counts and comment hydration for displayed proposals.
  - Gap: `userVoteRows` fetches all user votes globally (not limited to current project/page).

- `src/app/projects/[id]/page.tsx`
  - Good: clean server-component orchestration; mobile dialog + desktop inline form split is solid.
  - High-risk gap: similarity/suggestion context uses only paginated proposals (`proposalsWithStats`), so duplicate detection misses proposals on other pages.

- `src/app/projects/[id]/proposals/actions.ts`
  - Good: CSRF + auth + RBAC + audit + deadline enforcement on core create/vote/remove paths.
  - High-risk gap: `castVote`/`removeVote` trust client-provided `projectId` for deadline checks and revalidation, without verifying proposal ownership/project linkage.
  - Medium gap: no explicit proposal existence/ownership project validation before vote write.

- `src/app/projects/[id]/proposals/comment-actions.ts`
  - Good: scope validation for threaded comments is strong; deadline checks included.
  - Minor: duplicate `isDeadlinePassed` logic also exists in proposals actions (shared utility candidate).

- `src/components/proposal-list.tsx`
  - Good: vote-bar visualization and ranking are clear.
  - Medium gap: live SSE updates counts but not `userVote` state; pressed styling can be stale until full refresh.

- `src/components/vote-buttons.tsx`
  - Good: accessible `aria-pressed`, clear toggle behavior.
  - Minor: relies on parent `userVote`, which is not realtime-updated.

- `src/components/proposal-form.tsx` and `src/components/use-proposal-form.ts`
  - Good: similarity warnings and desktop/mobile form variants are well structured.
  - Medium gap: similarity warns only; it does not offer action on existing similar proposals (ideator had direct vote-in-modal flow).

- `src/components/suggest-proposals.tsx`
  - Good: usable AI suggestion workflow with per-item pro/contra selection.
  - Medium gap: toast strings are partly hardcoded (`"proposal(s) added"`) vs i18n keys.

- `src/app/api/proposals/suggest/route.ts`
  - Good: auth + rate-limit/config checks + parse fallback are robust.

- `src/app/api/proposals/similarity/route.ts`
  - Good: resilient parsing and Jaccard fallback.

- `src/app/api/proposals/submit-suggested/route.ts`
  - Good: auth/RBAC/CSRF checks and audit logs exist.
  - High-risk gap: no project deadline check, so AI-suggested proposal insertion can bypass closure rules enforced by server actions.
  - Medium gap: no SSE emit/notifications for inserted votes, so realtime feedback differs from manual voting path.

- `src/lib/vote-events.ts`, `src/lib/use-vote-stream.ts`, `src/app/api/votes/stream/route.ts`
  - Good: simple realtime pipeline works in single-process runtime.
  - High-risk architecture gap: in-memory event bus is process-local; in multi-instance deployment, vote updates won’t propagate across instances.

- `src/components/discussion-sheet.tsx`, `src/components/comment-thread.tsx`, `src/lib/use-comment-poll.ts`
  - Good: mobile-safe chat-style comments with periodic refresh and keyboard-inset handling.

## Live Tests (`curl`) — https://idea.surmont.co/
Test timestamp: `2026-02-17T00:58:10Z` (UTC)

- `GET /`
  - Status: `200`
  - Result: HTML rendered; includes proposal/voting product messaging and links.

- `GET /api/health`
  - Status: `200`
  - Body: `{"status":"healthy","timestamp":"2026-02-17T00:58:10.353Z","database":"ok","version":"0.1.0"}`

- `GET /auth/login`
  - Status: `200`
  - Result: login page renders with password + magic-link options.

- Static assets from homepage HTML
  - `GET /_next/static/chunks/50646a11aeded012.css` => `200`
  - `GET /_next/static/chunks/691c67b7004d7de6.js` => `200`

- Protected areas and voting stream auth
  - `GET /projects` => `307` redirect to `/auth/login?redirect=%2Fprojects`
  - `GET /api/votes/stream?projectId=test` (unauthenticated) => `401 {"error":"Unauthorized"}`

## Ideator Comparison (Features to Port)
Compared against:
- `app/actions/proposals.ts`
- `app/(app)/projects/[id]/page.tsx`
- `src/components/proposal-form.tsx`
- `src/components/proposal-list.tsx`
- `src/components/proposal-discussion-sheet.tsx`
- `src/components/suggest-proposals.tsx`
- `app/api/proposals/similarity/route.ts`

Port candidates:
- Similarity interception workflow: ideator blocks submit, shows a dedicated modal of similar proposals, and lets users vote those instead before deciding to “submit anyway.”
- Stronger similarity UX context: ideator displays richer match explanations and sorted confidence in a focused modal.
- Proposal author interaction loop: ideator’s similarity modal supports direct voting on existing similar proposals; ideate currently only warns inline.

Already improved in ideate (keep as-is):
- Better auth/RBAC/CSRF discipline.
- Better structured comment threading and scope validation.
- Cleaner separation of server actions/API routes vs UI hooks.

## Mobile Concerns
- Proposal list action density (`vote + discussion + accordion trigger`) is tight on small widths; accidental taps remain possible.
- Similarity warnings in proposal form can stack vertically and push submit controls below fold on small screens.
- Suggestion card controls are compact but still rely on precise taps; large-thumb ergonomics could be improved.
- Realtime vote change reflects counts quickly, but button active state can lag due to stale `userVote`.

## Prioritized Fixes
1. P0: Enforce proposal-project integrity in vote mutations.
- Files: `src/app/projects/[id]/proposals/actions.ts`
- Change: resolve `projectId` from `proposalId` server-side, compare/ignore client `projectId`, and run deadline checks on authoritative project.

2. P0: Block AI-suggested insertion after deadline.
- Files: `src/app/api/proposals/submit-suggested/route.ts`
- Change: reuse deadline-closure check before inserts; reject with consistent message.

3. P0: Fix duplicate-detection scope (all proposals, not current page).
- Files: `src/app/projects/[id]/page.tsx` plus query helper(s)
- Change: feed similarity/suggestion endpoints with full project proposal catalog (or top-N most relevant), not paginated slice.

4. P1: Replace in-memory vote event bus for production-safe realtime.
- Files: `src/lib/vote-events.ts`, `src/app/api/votes/stream/route.ts`, mutation emit points
- Change: move to shared backend channel (Redis pub/sub or DB-backed notifications).

5. P1: Wire `isNegativeInitiative` end-to-end.
- Files: proposal form + server actions + AI suggested submit path
- Change: expose UI control and persist it so negative initiatives are first-class.

6. P1: Bring suggestion submit path to parity with manual vote path.
- Files: `src/app/api/proposals/submit-suggested/route.ts`
- Change: emit vote updates and trigger notifications consistently.

7. P2: Mobile UX polish.
- Files: `src/components/proposal-list.tsx`, `src/components/proposal-form.tsx`, `src/components/suggest-proposals.tsx`
- Change: increase touch spacing, reduce action crowding, and preserve visible primary actions above fold.

8. P2: Query and i18n cleanup.
- Files: `src/app/projects/[id]/queries.ts`, `src/components/suggest-proposals.tsx`
- Change: scope user-vote query by project proposal IDs; remove hardcoded English success strings.
