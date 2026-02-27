# Sprint 55 — Advanced Permissions & Workflow Engine: Custom Stages & Approval Chains

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Configurable workflow stages, custom stage management, approval chains, conditional permissions, workflow UI integration

## Goals

- [x] **Goal 1: Workflow Schema & Engine** — Migration `drizzle/0027_sprint55_workflows.sql` adding 4 tables (`workflows`, `workflow_stages`, `proposal_workflow_state`, `approval_records`) with 6 indexes. Workflow engine at `src/lib/workflow/engine.ts` supporting linear stage transitions with role-based permissions. Default stages: Draft, Review, Voting, Approved.
- [x] **Goal 2: Custom Stage Management** — Workflow builder UI at `src/app/admin/workflows/page.tsx`. Admin can create workflows with custom stages, assign role permissions per stage. Stage editor with drag-style ordering and role toggle buttons.
- [x] **Goal 3: Approval Chain System** — Server actions in `src/app/admin/workflow-actions.ts` for advance/reject with comment support. Approval records stored per-stage with user attribution. Full audit trail via `logAudit()` integration.
- [x] **Goal 4: Conditional Permissions Engine** — Extended RBAC with `proposal:manage` permission (14th permission, admin + manager). Stage `allowedRoles` JSON field enables per-stage role restrictions. Engine validates user role before allowing transitions.
- [x] **Goal 5: Workflow UI Integration** — `WorkflowStatus` component on proposal cards showing progress bar, current stage, advance/reject controls. Workflow badge on `ProposalItem` with color-coded status. Admin page link with GitBranch icon.

## Outcomes

- 4 commits (Goal 1, Goals 2-5, tests, audit fixes)
- 1871 tests passing, 139 test files
- 34 new tests (engine: 23, server actions: 11)
- Lint and typecheck clean
- New files: engine module, 5 UI files (page, queries, loading, workflow-manager, workflow-status), 1 migration, 2 test files
- Modified: schema.ts + schema-pg.ts (4 new tables each), rbac.ts (+1 permission), audit.ts (+5 actions), en.ts + ro.ts (45+ keys each), admin page.tsx, proposal-item.tsx, project queries
- Schema parity maintained between SQLite and PostgreSQL

## Audit Results

### Architecture / Code Quality
- Clean engine module at `src/lib/workflow/engine.ts` (~400 lines) with 8 exported functions
- Server actions follow existing `withActionAuth` pattern with CSRF and permission checks
- All workflow actions audited via existing audit log system (5 new action types)
- Schema extends existing tables with proper foreign key cascades
- Translation coverage in both en.ts and ro.ts

### Security
- All server actions wrapped in `withActionAuth` with appropriate permissions
- CSRF token validation on all mutations
- Admin-only access enforced via `project:manage_all` and `proposal:manage` permissions
- Approval records provide immutable audit trail with user ID and timestamp
- Drizzle ORM parameterized queries prevent SQL injection
- Note (deferred): Cross-project authorization check for proposal actions could be tightened
- Note (deferred): Stage role names not validated against known role list

### Performance
- Added indexes: `idx_workflows_project` on `workflows(project_id)`, `idx_approval_records_user` on `approval_records(user_id)`
- Pre-existing indexes on workflow_stages.workflow_id, proposal_workflow_state.workflow_id, approval_records.proposal_id, approval_records.stage_id
- Note (deferred): N+1 in workflow state fetching within `getProjectProposals()` — acceptable for current page sizes
- Note (deferred): Admin workflows page loads all workflows without pagination — acceptable at current scale

### UX / Mobile
- Fixed: Dark mode badge contrast (blue/green/red-950 bg with -200 text)
- Fixed: Role toggle badges converted to accessible `<button>` elements with `aria-pressed`
- Fixed: Select element dark mode styling with `text-foreground`
- Fixed: Stage editor responsive layout with `sm:flex` breakpoints
- Added: ARIA `progressbar` role with valuenow/valuemin/valuemax on workflow progress
- Added: Loading skeleton page for initial render
- Progress bar visual: green (completed), blue (current), muted (remaining)

### Test Quality
- 23 engine tests covering: create, get, assign, advance, reject, approval history, error paths
- 11 server action tests covering: CRUD operations, validation, error propagation
- Mock patterns: `vi.resetAllMocks()` for engine tests (prevents implementation leak), `vi.clearAllMocks()` with manual re-setup for action tests (preserves mock chains)
- All error paths tested with proper assertions

## Notes
- Workflow engine supports linear stage progression only (branching paths deferred)
- Default stages configurable per-project; admins create workflow then assign to project
- `proposal:manage` permission enables managers to advance/reject proposals
- Dependencies: Existing RBAC system (Sprint 51), audit log system, Drizzle ORM schema
- Workflow tables: workflows, workflow_stages, proposal_workflow_state, approval_records
