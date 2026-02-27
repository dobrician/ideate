/**
 * Client-safe RBAC constants and types.
 * This file must NEVER import server-only modules (DB, fs, etc.).
 */

export type Role = "admin" | "manager" | "member" | "viewer";

export const BUILT_IN_ROLES: readonly Role[] = ["admin", "manager", "member", "viewer"];

export type Permission =
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "project:manage_all"
  | "proposal:create"
  | "proposal:read"
  | "proposal:delete"
  | "vote:cast"
  | "comment:create"
  | "comment:read"
  | "user:manage"
  | "proposal:manage"
  | "user:view_all";

export const ALL_PERMISSIONS: readonly Permission[] = [
  "project:create", "project:read", "project:update", "project:delete",
  "project:manage_all", "proposal:create", "proposal:read", "proposal:delete",
  "proposal:manage", "vote:cast", "comment:create", "comment:read",
  "user:manage", "user:view_all",
];
