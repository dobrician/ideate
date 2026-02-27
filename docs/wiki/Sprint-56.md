# Sprint 56 — Advanced Permissions: Time-based & Dynamic Permission Controls

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** Time-based permission rules, dynamic permission evaluation, fine-grained ACLs, permission monitoring, simulation tools

## Goals

- [x] **Goal 1: Time-based Permission Rules** — Migration `drizzle/0028_sprint56_permissions.sql` adding 2 tables (`permission_rules`, `resource_acls`) with 7 indexes. Permission rules support 4 rule types: time_expiry, schedule, deadline, condition. Each rule targets user, role, or all users with grant/deny effect.
- [x] **Goal 2: Dynamic Permission Evaluation** — Dynamic RBAC engine at `src/lib/rbac/dynamic.ts` with layered evaluation: ACL deny > rule deny > ACL grant > rule grant > static RBAC fallback. Supports schedule configs (day/hour/timezone), conditional rules (vote thresholds, authorship windows), and entity-scoped rules.
- [x] **Goal 3: Advanced Access Control Lists** — Per-resource ACLs in `resource_acls` table. Supports grant/deny per entity (project/proposal) for specific users or roles. Includes expiry, delegation tracking (granted_by), and reason field for audit trail.
- [x] **Goal 4: Permission Monitoring & Alerts** — 5 new audit actions (`permission_rule.create`, `permission_rule.update`, `permission_rule.delete`, `acl.grant`, `acl.revoke`) with 2 new audit entities. Admin permissions page at `/admin/permissions` with stats dashboard (total rules, active rules, ACLs, deny rules).
- [x] **Goal 5: Permission Testing & Simulation** — Permission simulator at `/admin/permissions/test` allows admins to test any user/role/permission/resource combination. Shows final verdict, static RBAC result, matching rules with applicability, and matching ACLs.

## Outcomes

- 2 commits (implementation + audit fixes)
- 1917 tests passing, 141 test files
- 46 new tests (25 dynamic RBAC engine, 21 server actions)
- Lint and typecheck clean
- New files: dynamic RBAC module, 6 UI files (page, queries, loading, rule-manager, test page, simulator), 1 migration, 1 server action file, 2 test files
- Modified: schema.ts + schema-pg.ts (2 new tables each), audit.ts (+5 actions, +2 entities), admin page.tsx (permissions link), en.ts + ro.ts (65+ keys each)
- Schema parity maintained between SQLite and PostgreSQL

## Audit Results

### Architecture / Code Quality
- Clean separation: dynamic RBAC engine is independent module, extends existing static RBAC
- Server actions follow existing `withActionAuth` pattern with CSRF and permission checks
- All permission mutations audited via existing audit log system (5 new action types)
- Layered evaluation order is explicit and well-documented in module header
- JSON validation added for schedule and condition fields in server actions

### Security
- All server actions wrapped in `withActionAuth` with `user:manage` permission
- CSRF token validation on all mutations
- Admin-only access enforced via `user:manage` permission
- Drizzle ORM parameterized queries prevent SQL injection
- JSON fields validated server-side before storage (schedule shape, condition shape)
- Input length limits on rule names (max 255 chars)
- Deferred: Entity existence validation for ACL entityId (acceptable — admin-only feature)
- Deferred: targetId validation against actual users/roles (acceptable — admin-only, audited)

### Performance
- Query optimization: `getApplicableRules()` accepts optional `permission` parameter for DB-level filtering
- Stats query consolidated from 4 separate queries to 2 parallel queries with aggregation
- Indexes: 7 indexes across 2 tables covering target, permission, active, expires, entity, grantee
- Deferred: Composite indexes for multi-column filters (acceptable at current scale)
- Deferred: JSON parsing caching (acceptable — rules evaluated infrequently in admin context)
- Deferred: Pagination on admin queries (acceptable — admin-only with small rule sets)

### UX / Mobile
- Admin permissions page follows existing admin layout patterns
- Stats dashboard with 4 stat cards matching admin page style
- Tab-based UI for switching between Rules and ACLs views
- Collapsible create forms to minimize page noise
- Color-coded badges: green for grant, red for deny
- Rule type icons: Clock (time_expiry), Calendar (schedule), GitBranch (deadline), Zap (condition)
- Active/inactive and expired status badges
- Back navigation to admin page

### Test Quality
- 25 engine tests covering: schedule evaluation (5 scenarios), condition evaluation (10+ scenarios including all operators, authorship windows, edge cases), rule application (8 scenarios including entity scope, schedule, condition, malformed JSON)
- 21 server action tests covering: CRUD for rules and ACLs, validation errors (empty name, invalid permission, invalid types), update/delete with missing IDs, simulation endpoint
- Mock patterns consistent with existing test conventions

## Notes
- Dynamic RBAC extends but does not replace static RBAC; static checks remain the default
- Permission rules are admin-only features; regular users are not affected by rule management
- Schedule-based rules support IANA timezones with UTC fallback
- Condition system is extensible: currently supports vote_count and authorship_window types
- Simulation tool is read-only; never modifies permission state
- All rule/ACL operations are fully reversible through admin UI
