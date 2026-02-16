# Sprint 24 Project Detail Analysis (Codex)

Date: 2026-02-16

Note: `docs/sprint24-analysis-claude.md` was not read. This analysis is independent.

## Scope
Analyzed project detail surface for `src/app/projects/[id]` and directly related components/API/tests, then compared against `/home/dc/work/ideator` for feature parity opportunities.

## Current Files (Project Detail Surface)

### Pages and Server Actions
- `src/app/projects/[id]/page.tsx`
- `src/app/projects/[id]/queries.ts`
- `src/app/projects/[id]/proposals/actions.ts`
- `src/app/projects/[id]/proposals/comment-actions.ts`
- `src/app/projects/[id]/delete-button.tsx`
- `src/app/projects/[id]/edit/page.tsx`
- `src/app/projects/actions.ts`

### Components Used by Project Detail
- `src/components/proposal-list.tsx`
- `src/components/proposal-form.tsx`
- `src/components/vote-buttons.tsx`
- `src/components/discussion-sheet.tsx`
- `src/components/comment-thread.tsx`
- `src/components/project-comments.tsx`
- `src/components/deadline-countdown.tsx`
- `src/components/export-buttons.tsx`
- `src/components/regenerate-summary-button.tsx`
- `src/components/suggest-proposals.tsx`

### Related API Routes
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/export/route.ts`
- `src/app/api/projects/[id]/summary/route.ts`
- `src/app/api/proposals/suggest/route.ts`
- `src/app/api/proposals/submit-suggested/route.ts`
- `src/app/api/proposals/similarity/route.ts`
- `src/app/api/votes/stream/route.ts`

### Related Infra/Data
- `src/db/queries.ts`
- `src/db/schema.ts`
- `src/lib/use-vote-stream.ts`
- `src/middleware.ts`

### Tests Covering This Surface
- E2E: `tests/e2e/comments.test.ts`, `tests/e2e/voting.test.ts`, `tests/e2e/ai-suggestions.test.ts`, `tests/e2e/api.test.ts`, `tests/e2e/security.test.ts`, `tests/e2e/csrf.test.ts`
- Unit: `tests/unit/proposals.test.ts`, `tests/unit/vote-actions.test.ts`, `tests/unit/comment-actions.test.ts`, `tests/unit/proposal-list.dom.test.tsx`, `tests/unit/vote-buttons.dom.test.tsx`, `tests/unit/suggest-api.test.ts`, `tests/unit/similarity-api.test.ts`

## Per-File Assessment

### `src/app/projects/[id]/page.tsx`
- Good: server component, auth gate, RBAC checks for edit/admin controls, pagination wiring, summary regeneration and AI suggestions integrated.
- Gap: no route-local error boundary/loading for this page segment (`src/app/projects/[id]/error.tsx` and `src/app/projects/[id]/loading.tsx` are missing), despite project rule requiring page-level error/loading handling.
- Gap: proposal ranking is page-local. Data is paginated by `createdAt` in query, then re-sorted by votes only inside current page (`src/app/projects/[id]/page.tsx:101`, `src/app/projects/[id]/queries.ts:60`, `src/components/proposal-list.tsx:70`). This can mis-rank overall priority.
- Gap: AI duplicate avoidance only sees currently loaded proposals (`src/app/projects/[id]/page.tsx:211`). On page 2+, suggestions/similarity can miss older proposals.

### `src/app/projects/[id]/queries.ts`
- Good: aggregates upvotes/downvotes and joins author/comments in one pass.
- Gap: orders by `createdAt desc` (`src/app/projects/[id]/queries.ts:60`) while UI goal is prioritization by consensus; current architecture sorts by votes only after pagination.
- Gap: fetches current user votes without constraining to project proposal IDs (`src/app/projects/[id]/queries.ts:68`), which is avoidable overhead.

### `src/app/projects/[id]/proposals/comment-actions.ts`
- Good: validates content length, enforces exactly one of `proposalId`/`projectId`, logs audit.
- High-risk bug: deadline closure is only checked when `projectId` is directly present in form data (`src/app/projects/[id]/proposals/comment-actions.ts:62`). Proposal comments submitted with only `proposalId` bypass deadline enforcement.
- Gap: for proposal comments with no `projectId`, `revalidatePath` is skipped (`src/app/projects/[id]/proposals/comment-actions.ts:97`), reducing consistency for other viewers.

### `src/components/discussion-sheet.tsx`
- High-risk bug source: receives `projectId` prop but does not pass it into hidden fields; only `proposalId` is submitted (`src/components/discussion-sheet.tsx:44`). This directly enables the comment-action deadline bypass above and weak revalidation.

### `src/components/comment-thread.tsx`
- Gap vs data model: `buildCommentTree` is a flat chronological sort, not threaded (`src/components/comment-thread.tsx:24`), while schema supports `parentId` threading (`src/db/schema.ts:128`) and action accepts `parentId`.
- Gap: comments are rendered plain text bubbles; Markdown comment content from model is not rendered.

### `src/components/project-comments.tsx`
- Good: unified reusable thread for project-level discussion.
- Mobile concern: fixed `h-[400px]` (`src/components/project-comments.tsx:26`) can feel cramped/awkward on smaller screens and keyboard-open states.

### `src/components/proposal-list.tsx`
- Good: live vote updates with SSE map and voting bars.
- Gap: uses summary/description as plain text (`src/components/proposal-list.tsx:225`) while model fields are markdown-capable.
- Gap: local sort only; does not fix server-side ranking/pagination mismatch.

### `src/components/proposal-form.tsx`
- Good: debounced similarity check, proper form validation limits, CSRF hidden field.
- Gap: similarity warnings are advisory only; no “vote existing similar proposal instead” shortcut (available in ideator).

### `src/components/suggest-proposals.tsx`
- Good: full generate/review/select flow and detail dialog.
- Gap: success toast string is hardcoded English, not localized (`src/components/suggest-proposals.tsx:126`).

### `src/app/projects/[id]/edit/page.tsx`
- Gap vs architecture rule (“Server Components by default”): edit page is fully client-side and fetches project data from API (`src/app/projects/[id]/edit/page.tsx:1`, `src/app/projects/[id]/edit/page.tsx:46`) where server-rendered data load would be simpler and more robust.

### API routes (`src/app/api/projects/[id]/*`, `src/app/api/proposals/*`, `src/app/api/votes/stream/route.ts`)
- Good: core endpoints exist and generally enforce auth.
- Gap: unauthorized behavior is inconsistent at runtime because middleware redirects many protected API requests to login (307) instead of JSON 401 (`src/middleware.ts:133`). Some API endpoints (e.g. votes stream) still return JSON 401 in handler (`src/app/api/votes/stream/route.ts:17`).

### Tests
- Good: there is meaningful E2E coverage for voting/comments/AI suggestions and unit coverage for proposal and vote/comment actions.
- Gap: no direct tests for detail page server route behavior (`src/app/projects/[id]/page.tsx`), project detail query function (`src/app/projects/[id]/queries.ts`), or project-related API route handlers (`src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/summary/route.ts`, `src/app/api/projects/[id]/export/route.ts`, `src/app/api/votes/stream/route.ts`).
- Gap: `tests/unit/similarity-api.test.ts` tests duplicated helper logic, not the route module itself; this can drift from production code.
- Gap: no mobile viewport E2E assertions for project detail interactions.

## Live Tests (`curl` against `https://idea.surmont.co`)

Command style used: unauthenticated `curl` with headers/body inspection.

- `GET /` -> `200`, HTML returned.
- `GET /projects` -> `307` redirect to `/auth/login?redirect=%2Fprojects`.
- `GET /projects/nonexistent` -> `307` redirect to login.
- `GET /api/health` -> `200`, JSON `{ status: "healthy", database: "ok", ... }`.
- `GET /api/projects/test` -> `307` redirect to login.
- `GET /api/projects/test/export?format=csv` -> `307` redirect to login.
- `GET /api/projects/test/export?format=invalid` -> `307` redirect to login (format validation unreachable before auth).
- `GET /api/votes/stream?projectId=test` -> `401` JSON `{ "error": "Unauthorized" }`.
- `POST /api/projects/test/summary` -> `307` redirect to login.
- `POST /api/proposals/suggest` -> `307` redirect to login.
- `POST /api/proposals/submit-suggested` -> `307` redirect to login.
- `POST /api/proposals/similarity` -> `307` redirect to login.

Assessment of live behavior:
- App is up and health endpoint is healthy.
- Most protected project/proposal APIs currently appear as browser-style redirects when unauthenticated, not consistent API JSON errors.

## Ideator Comparison (Features to Port)
Compared with:
- `/home/dc/work/ideator/app/(app)/projects/[id]/page.tsx`
- `/home/dc/work/ideator/src/components/project-description-toggle.tsx`
- `/home/dc/work/ideator/src/components/proposal-form.tsx`
- `/home/dc/work/ideator/src/components/proposal-list.tsx`
- `/home/dc/work/ideator/src/components/proposal-discussion-sheet.tsx`

Useful features/patterns in ideator worth porting:
- Markdown rendering for project title/description and proposal content (`/home/dc/work/ideator/app/(app)/projects/[id]/page.tsx:177`, `/home/dc/work/ideator/src/components/proposal-list.tsx:82`).
- Explicit project description summary/full toggle component (`/home/dc/work/ideator/src/components/project-description-toggle.tsx`).
- Similarity modal with fast “vote existing similar proposal” action (`/home/dc/work/ideator/src/components/proposal-form.tsx:163`).
- Desktop sticky proposal form layout (`/home/dc/work/ideator/app/(app)/projects/[id]/page.tsx:235`).
- Richer discussion sheet UX with clearer metadata and markdown comments (`/home/dc/work/ideator/src/components/proposal-discussion-sheet.tsx:110`).

## Mobile Concerns
- Fixed discussion heights (`h-[400px]` in `src/components/project-comments.tsx:26`, `h-[calc(100vh-10rem)]` in `src/components/discussion-sheet.tsx:43`) may clip or create awkward scrolling with mobile keyboards.
- Top action cluster (export + edit/delete + suggestion + create) can become dense in narrow widths (`src/app/projects/[id]/page.tsx:117`, `src/app/projects/[id]/page.tsx:206`).
- Vote + discussion controls inside accordion trigger area are compact; touch targets should be re-checked on small devices (`src/components/proposal-list.tsx:200`).

## Prioritized Remaining Fixes

### P0 (highest)
1. Fix proposal-comment deadline bypass and revalidation consistency.
- Pass `projectId` through discussion sheet form hidden fields and enforce deadline for both project and proposal comments.
- Files: `src/components/discussion-sheet.tsx`, `src/app/projects/[id]/proposals/comment-actions.ts`.

2. Align ranking model with pagination.
- Sort proposals server-side by net score (and tie-breaks), then paginate that ordering; stop page-local-only ranking.
- Files: `src/app/projects/[id]/queries.ts`, `src/components/proposal-list.tsx`.

3. Include full proposal corpus for AI duplicate checks.
- `existingProposals` used by similarity/suggest should be full project set (or a separate lightweight full-list query), not just current page.
- Files: `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/queries.ts`.

### P1
4. Implement true threaded comments UI and parent-child rendering.
- Current data model/action support threading; UI currently flattens.
- Files: `src/components/comment-thread.tsx`, `src/app/projects/[id]/proposals/comment-actions.ts`.

5. Add route-local loading and error boundaries for detail page segment.
- Create `src/app/projects/[id]/loading.tsx` and `src/app/projects/[id]/error.tsx`.

6. Normalize unauthenticated API behavior.
- Decide and enforce one policy for API endpoints (prefer JSON 401 for API consumers).
- Files: `src/middleware.ts` and affected API routes.

### P2
7. Render markdown where model says markdown.
- Project description and proposal/comment bodies should use markdown renderer with safe sanitization.
- Files: `src/app/projects/[id]/page.tsx`, `src/components/proposal-list.tsx`, `src/components/comment-thread.tsx`.

8. Improve mobile ergonomics.
- Replace fixed heights with viewport-safe responsive containers and keyboard-safe behavior.
- Files: `src/components/project-comments.tsx`, `src/components/discussion-sheet.tsx`.

9. Fill test gaps for uncovered detail routes/components.
- Add tests for page route behavior, queries, project detail APIs, and mobile viewport coverage.
- Files: add under `tests/unit/` and `tests/e2e/` mapped to listed source files.

## Summary
Core project detail functionality is present and generally solid, but the biggest remaining risks are: deadline enforcement gap in proposal comments, ranking/pagination mismatch for prioritization integrity, partial dataset feeding AI similarity/suggestion checks, and missing page-level route safety/loading artifacts for `[id]`.
