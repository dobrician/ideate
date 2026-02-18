/**
 * Unit tests for RBAC library (src/lib/rbac.ts).
 *
 * Covers:
 *  - hasPermission for all 4 roles (admin, manager, member, viewer)
 *  - canManageResource for owner vs non-owner
 *  - Role-specific permission boundaries
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canManageResource,
  getPermissionsForRole,
  getCustomRoleNames,
  invalidateRoleCache,
  ALL_PERMISSIONS,
  BUILT_IN_ROLES,
  type Role,
  type Permission,
} from "@/lib/rbac";

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------

describe("hasPermission", () => {
  describe("admin role", () => {
    const role: Role = "admin";

    it("should have project:create permission", () => {
      expect(hasPermission(role, "project:create")).toBe(true);
    });

    it("should have project:read permission", () => {
      expect(hasPermission(role, "project:read")).toBe(true);
    });

    it("should have project:update permission", () => {
      expect(hasPermission(role, "project:update")).toBe(true);
    });

    it("should have project:delete permission", () => {
      expect(hasPermission(role, "project:delete")).toBe(true);
    });

    it("should have project:manage_all permission", () => {
      expect(hasPermission(role, "project:manage_all")).toBe(true);
    });

    it("should have proposal:create permission", () => {
      expect(hasPermission(role, "proposal:create")).toBe(true);
    });

    it("should have proposal:read permission", () => {
      expect(hasPermission(role, "proposal:read")).toBe(true);
    });

    it("should have proposal:delete permission", () => {
      expect(hasPermission(role, "proposal:delete")).toBe(true);
    });

    it("should have vote:cast permission", () => {
      expect(hasPermission(role, "vote:cast")).toBe(true);
    });

    it("should have comment:create permission", () => {
      expect(hasPermission(role, "comment:create")).toBe(true);
    });

    it("should have comment:read permission", () => {
      expect(hasPermission(role, "comment:read")).toBe(true);
    });

    it("should have user:manage permission", () => {
      expect(hasPermission(role, "user:manage")).toBe(true);
    });

    it("should have user:view_all permission", () => {
      expect(hasPermission(role, "user:view_all")).toBe(true);
    });

    it("should have all 13 permissions", () => {
      const all: Permission[] = [
        "project:create", "project:read", "project:update", "project:delete",
        "project:manage_all", "proposal:create", "proposal:read", "proposal:delete",
        "vote:cast", "comment:create", "comment:read", "user:manage", "user:view_all",
      ];
      for (const p of all) expect(hasPermission(role, p)).toBe(true);
    });
  });

  describe("manager role", () => {
    const role: Role = "manager";

    it("should have project:create permission", () => {
      expect(hasPermission(role, "project:create")).toBe(true);
    });

    it("should have project:read permission", () => {
      expect(hasPermission(role, "project:read")).toBe(true);
    });

    it("should have project:update permission", () => {
      expect(hasPermission(role, "project:update")).toBe(true);
    });

    it("should have project:delete permission", () => {
      expect(hasPermission(role, "project:delete")).toBe(true);
    });

    it("should NOT have project:manage_all permission", () => {
      expect(hasPermission(role, "project:manage_all")).toBe(false);
    });

    it("should have proposal:create permission", () => {
      expect(hasPermission(role, "proposal:create")).toBe(true);
    });

    it("should have proposal:read permission", () => {
      expect(hasPermission(role, "proposal:read")).toBe(true);
    });

    it("should have proposal:delete permission", () => {
      expect(hasPermission(role, "proposal:delete")).toBe(true);
    });

    it("should have vote:cast permission", () => {
      expect(hasPermission(role, "vote:cast")).toBe(true);
    });

    it("should have comment:create permission", () => {
      expect(hasPermission(role, "comment:create")).toBe(true);
    });

    it("should have comment:read permission", () => {
      expect(hasPermission(role, "comment:read")).toBe(true);
    });

    it("should NOT have user:manage permission", () => {
      expect(hasPermission(role, "user:manage")).toBe(false);
    });

    it("should have user:view_all permission", () => {
      expect(hasPermission(role, "user:view_all")).toBe(true);
    });

    it("should have 11 permissions (all except manage_all and user:manage)", () => {
      expect(hasPermission(role, "project:manage_all")).toBe(false);
      expect(hasPermission(role, "user:manage")).toBe(false);
    });
  });

  describe("member role", () => {
    const role: Role = "member";

    it("should have project:create permission", () => {
      expect(hasPermission(role, "project:create")).toBe(true);
    });

    it("should have project:read permission", () => {
      expect(hasPermission(role, "project:read")).toBe(true);
    });

    it("should NOT have project:update permission", () => {
      expect(hasPermission(role, "project:update")).toBe(false);
    });

    it("should NOT have project:delete permission", () => {
      expect(hasPermission(role, "project:delete")).toBe(false);
    });

    it("should NOT have project:manage_all permission", () => {
      expect(hasPermission(role, "project:manage_all")).toBe(false);
    });

    it("should have proposal:create permission", () => {
      expect(hasPermission(role, "proposal:create")).toBe(true);
    });

    it("should have proposal:read permission", () => {
      expect(hasPermission(role, "proposal:read")).toBe(true);
    });

    it("should NOT have proposal:delete permission", () => {
      expect(hasPermission(role, "proposal:delete")).toBe(false);
    });

    it("should have vote:cast permission", () => {
      expect(hasPermission(role, "vote:cast")).toBe(true);
    });

    it("should have comment:create permission", () => {
      expect(hasPermission(role, "comment:create")).toBe(true);
    });

    it("should have comment:read permission", () => {
      expect(hasPermission(role, "comment:read")).toBe(true);
    });

    it("should NOT have user:manage permission", () => {
      expect(hasPermission(role, "user:manage")).toBe(false);
    });

    it("should NOT have user:view_all permission", () => {
      expect(hasPermission(role, "user:view_all")).toBe(false);
    });

    it("should have 7 permissions", () => {
      const expected: Permission[] = [
        "project:create", "project:read", "proposal:create", "proposal:read",
        "vote:cast", "comment:create", "comment:read",
      ];
      for (const p of expected) expect(hasPermission(role, p)).toBe(true);
    });
  });

  describe("viewer role", () => {
    const role: Role = "viewer";

    it("should NOT have project:create permission", () => {
      expect(hasPermission(role, "project:create")).toBe(false);
    });

    it("should have project:read permission", () => {
      expect(hasPermission(role, "project:read")).toBe(true);
    });

    it("should NOT have project:update permission", () => {
      expect(hasPermission(role, "project:update")).toBe(false);
    });

    it("should NOT have project:delete permission", () => {
      expect(hasPermission(role, "project:delete")).toBe(false);
    });

    it("should NOT have project:manage_all permission", () => {
      expect(hasPermission(role, "project:manage_all")).toBe(false);
    });

    it("should NOT have proposal:create permission", () => {
      expect(hasPermission(role, "proposal:create")).toBe(false);
    });

    it("should have proposal:read permission", () => {
      expect(hasPermission(role, "proposal:read")).toBe(true);
    });

    it("should NOT have proposal:delete permission", () => {
      expect(hasPermission(role, "proposal:delete")).toBe(false);
    });

    it("should NOT have vote:cast permission", () => {
      expect(hasPermission(role, "vote:cast")).toBe(false);
    });

    it("should NOT have comment:create permission", () => {
      expect(hasPermission(role, "comment:create")).toBe(false);
    });

    it("should have comment:read permission", () => {
      expect(hasPermission(role, "comment:read")).toBe(true);
    });

    it("should NOT have user:manage permission", () => {
      expect(hasPermission(role, "user:manage")).toBe(false);
    });

    it("should NOT have user:view_all permission", () => {
      expect(hasPermission(role, "user:view_all")).toBe(false);
    });

    it("should only have 3 read-only permissions", () => {
      const reads: Permission[] = ["project:read", "proposal:read", "comment:read"];
      for (const p of reads) expect(hasPermission(role, p)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// canManageResource
// ---------------------------------------------------------------------------

describe("canManageResource", () => {
  const userId = "user-123";
  const otherUserId = "user-456";

  it("should return true for admin regardless of ownership", () => {
    expect(canManageResource("admin", otherUserId, userId)).toBe(true);
  });

  it("should return true for admin even when resourceOwnerId is null", () => {
    expect(canManageResource("admin", null, userId)).toBe(true);
  });

  it("should return true for manager who owns the resource", () => {
    expect(canManageResource("manager", userId, userId)).toBe(true);
  });

  it("should return false for manager who does not own the resource", () => {
    expect(canManageResource("manager", otherUserId, userId)).toBe(false);
  });

  it("should return true for member who owns the resource", () => {
    expect(canManageResource("member", userId, userId)).toBe(true);
  });

  it("should return false for member who does not own the resource", () => {
    expect(canManageResource("member", otherUserId, userId)).toBe(false);
  });

  it("should return true for viewer who owns the resource", () => {
    expect(canManageResource("viewer", userId, userId)).toBe(true);
  });

  it("should return false for viewer who does not own the resource", () => {
    expect(canManageResource("viewer", otherUserId, userId)).toBe(false);
  });

  it("should return false for non-admin when resourceOwnerId is null", () => {
    expect(canManageResource("member", null, userId)).toBe(false);
  });

  it("should return false for manager when resourceOwnerId is null", () => {
    expect(canManageResource("manager", null, userId)).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Cross-cutting permission boundary verifications
// ---------------------------------------------------------------------------

describe("Permission boundary verifications", () => {
  it("admin should have project:manage_all but member should not", () => {
    expect(hasPermission("admin", "project:manage_all")).toBe(true);
    expect(hasPermission("member", "project:manage_all")).toBe(false);
  });

  it("admin should have user:manage but no other role should", () => {
    expect(hasPermission("admin", "user:manage")).toBe(true);
    expect(hasPermission("manager", "user:manage")).toBe(false);
    expect(hasPermission("member", "user:manage")).toBe(false);
    expect(hasPermission("viewer", "user:manage")).toBe(false);
  });

  it("viewer should only be able to read, not write or modify", () => {
    const writePermissions: Permission[] = [
      "project:create",
      "project:update",
      "project:delete",
      "project:manage_all",
      "proposal:create",
      "proposal:delete",
      "vote:cast",
      "comment:create",
      "user:manage",
    ];
    for (const perm of writePermissions) {
      expect(hasPermission("viewer", perm)).toBe(false);
    }
  });

  it("viewer should have exactly the read permissions", () => {
    const readPermissions: Permission[] = [
      "project:read",
      "proposal:read",
      "comment:read",
    ];
    for (const perm of readPermissions) {
      expect(hasPermission("viewer", perm)).toBe(true);
    }
  });

  it("member should be able to create proposals and vote but not delete", () => {
    expect(hasPermission("member", "proposal:create")).toBe(true);
    expect(hasPermission("member", "vote:cast")).toBe(true);
    expect(hasPermission("member", "proposal:delete")).toBe(false);
  });

  it("manager should be able to delete proposals but not manage all projects", () => {
    expect(hasPermission("manager", "proposal:delete")).toBe(true);
    expect(hasPermission("manager", "project:manage_all")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// New exports: ALL_PERMISSIONS, BUILT_IN_ROLES, getPermissionsForRole, etc.
// ---------------------------------------------------------------------------

describe("ALL_PERMISSIONS", () => {
  it("should contain 13 permissions", () => {
    expect(ALL_PERMISSIONS).toHaveLength(13);
  });

  it("should include all expected permissions", () => {
    expect(ALL_PERMISSIONS).toContain("project:create");
    expect(ALL_PERMISSIONS).toContain("user:manage");
    expect(ALL_PERMISSIONS).toContain("vote:cast");
  });
});

describe("BUILT_IN_ROLES", () => {
  it("should contain the 4 built-in roles", () => {
    expect(BUILT_IN_ROLES).toEqual(["admin", "manager", "member", "viewer"]);
  });
});

describe("getPermissionsForRole", () => {
  it("should return all permissions for admin", () => {
    const perms = getPermissionsForRole("admin");
    expect(perms.size).toBe(13);
  });

  it("should return 3 permissions for viewer", () => {
    const perms = getPermissionsForRole("viewer");
    expect(perms.size).toBe(3);
  });

  it("should return empty set for unknown role", () => {
    const perms = getPermissionsForRole("unknown-custom");
    expect(perms.size).toBe(0);
  });
});

describe("getCustomRoleNames", () => {
  it("should return empty array when no custom roles loaded", () => {
    invalidateRoleCache();
    expect(getCustomRoleNames()).toEqual([]);
  });
});

describe("invalidateRoleCache", () => {
  it("should not throw", () => {
    expect(() => invalidateRoleCache()).not.toThrow();
  });
});
