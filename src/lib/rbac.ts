/**
 * Role-based access control (RBAC) for Ideate.
 * Defines permissions per role and provides authorization helpers.
 */

export type Role = "admin" | "manager" | "member" | "viewer";

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
  | "user:view_all";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "project:manage_all",
    "proposal:create",
    "proposal:read",
    "proposal:delete",
    "vote:cast",
    "comment:create",
    "comment:read",
    "user:manage",
    "user:view_all",
  ]),
  manager: new Set<Permission>([
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "proposal:create",
    "proposal:read",
    "proposal:delete",
    "vote:cast",
    "comment:create",
    "comment:read",
    "user:view_all",
  ]),
  member: new Set<Permission>([
    "project:create",
    "project:read",
    "proposal:create",
    "proposal:read",
    "vote:cast",
    "comment:create",
    "comment:read",
  ]),
  viewer: new Set<Permission>([
    "project:read",
    "proposal:read",
    "comment:read",
  ]),
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check if a user can manage a resource (owns it or has manage_all)
 */
export function canManageResource(
  role: Role,
  resourceOwnerId: string | null,
  userId: string
): boolean {
  if (hasPermission(role, "project:manage_all")) return true;
  return resourceOwnerId === userId;
}

