/**
 * Role-based access control (RBAC) for Ideate.
 * Supports 4 built-in roles and dynamic custom roles stored in the DB.
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
  | "user:view_all";

export const ALL_PERMISSIONS: readonly Permission[] = [
  "project:create", "project:read", "project:update", "project:delete",
  "project:manage_all", "proposal:create", "proposal:read", "proposal:delete",
  "vote:cast", "comment:create", "comment:read", "user:manage", "user:view_all",
];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "project:create", "project:read", "project:update", "project:delete",
    "project:manage_all", "proposal:create", "proposal:read", "proposal:delete",
    "vote:cast", "comment:create", "comment:read", "user:manage", "user:view_all",
  ]),
  manager: new Set<Permission>([
    "project:create", "project:read", "project:update", "project:delete",
    "proposal:create", "proposal:read", "proposal:delete",
    "vote:cast", "comment:create", "comment:read", "user:view_all",
  ]),
  member: new Set<Permission>([
    "project:create", "project:read",
    "proposal:create", "proposal:read",
    "vote:cast", "comment:create", "comment:read",
  ]),
  viewer: new Set<Permission>([
    "project:read", "proposal:read", "comment:read",
  ]),
};

/** In-memory cache for custom roles loaded from DB */
let customRoleCache: Map<string, ReadonlySet<Permission>> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

/**
 * Load custom roles from DB into cache.
 * Called lazily when a non-built-in role is checked.
 */
export async function loadCustomRoles(): Promise<void> {
  const { db } = await import("@/db");
  const { customRoles } = await import("@/db/schema");
  const rows = await db.select().from(customRoles);
  const map = new Map<string, ReadonlySet<Permission>>();
  for (const row of rows) {
    const perms = JSON.parse(row.permissions) as string[];
    const valid = perms.filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission)
    );
    map.set(row.name, new Set(valid));
  }
  customRoleCache = map;
  cacheLoadedAt = Date.now();
}

/** Invalidate cache (called after create/update/delete) */
export function invalidateRoleCache(): void {
  cacheLoadedAt = 0;
}

/** Check if cache is stale */
function isCacheStale(): boolean {
  return Date.now() - cacheLoadedAt > CACHE_TTL_MS;
}

/**
 * Check if a role has a specific permission (sync, built-in only).
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check permission for any role (built-in or custom, async).
 */
export async function hasPermissionAsync(
  role: string,
  permission: Permission
): Promise<boolean> {
  if (BUILT_IN_ROLES.includes(role as Role)) {
    return hasPermission(role as Role, permission);
  }
  if (isCacheStale()) await loadCustomRoles();
  return customRoleCache.get(role)?.has(permission) ?? false;
}

/**
 * Get permissions for any role (built-in or custom).
 */
export function getPermissionsForRole(role: string): ReadonlySet<Permission> {
  if (BUILT_IN_ROLES.includes(role as Role)) {
    return ROLE_PERMISSIONS[role as Role];
  }
  return customRoleCache.get(role) ?? new Set();
}

/** Get all cached custom role names */
export function getCustomRoleNames(): string[] {
  return Array.from(customRoleCache.keys());
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
