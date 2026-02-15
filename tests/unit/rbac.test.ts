/**
 * Unit tests for RBAC library (src/lib/rbac.ts).
 *
 * Covers:
 *  - hasPermission for all 4 roles (admin, manager, member, viewer)
 *  - canManageResource for owner vs non-owner
 *  - requirePermission throws on forbidden
 *  - canModifyResource checks both permission and ownership
 *  - Role-specific permission boundaries
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canManageResource,
  getPermissions,
  requirePermission,
  canModifyResource,
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
      expect(getPermissions(role).size).toBe(13);
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
      expect(getPermissions(role).size).toBe(11);
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
      expect(getPermissions(role).size).toBe(7);
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
      expect(getPermissions(role).size).toBe(3);
    });

    it("should only contain read permissions", () => {
      const perms = getPermissions(role);
      for (const perm of perms) {
        expect(perm).toMatch(/:read$/);
      }
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
// getPermissions
// ---------------------------------------------------------------------------

describe("getPermissions", () => {
  it("should return a ReadonlySet for admin", () => {
    const perms = getPermissions("admin");
    expect(perms).toBeInstanceOf(Set);
    expect(perms.size).toBeGreaterThan(0);
  });

  it("should return a ReadonlySet for viewer", () => {
    const perms = getPermissions("viewer");
    expect(perms).toBeInstanceOf(Set);
    expect(perms.size).toBe(3);
  });

  it("should return admin permissions as a superset of manager permissions", () => {
    const adminPerms = getPermissions("admin");
    const managerPerms = getPermissions("manager");
    for (const perm of managerPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it("should return manager permissions as a superset of member permissions", () => {
    const managerPerms = getPermissions("manager");
    const memberPerms = getPermissions("member");
    for (const perm of memberPerms) {
      expect(managerPerms.has(perm)).toBe(true);
    }
  });

  it("should return member permissions as a superset of viewer permissions", () => {
    const memberPerms = getPermissions("member");
    const viewerPerms = getPermissions("viewer");
    for (const perm of viewerPerms) {
      expect(memberPerms.has(perm)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------

describe("requirePermission", () => {
  it("should not throw when admin has the requested permission", () => {
    expect(() => requirePermission("admin", "project:manage_all")).not.toThrow();
  });

  it("should not throw when member has project:read", () => {
    expect(() => requirePermission("member", "project:read")).not.toThrow();
  });

  it("should not throw when viewer has comment:read", () => {
    expect(() => requirePermission("viewer", "comment:read")).not.toThrow();
  });

  it("should throw for viewer trying to create a project", () => {
    expect(() => requirePermission("viewer", "project:create")).toThrow(
      /Forbidden.*viewer.*project:create/
    );
  });

  it("should throw for member trying to delete a project", () => {
    expect(() => requirePermission("member", "project:delete")).toThrow(
      /Forbidden.*member.*project:delete/
    );
  });

  it("should throw for manager trying to manage all projects", () => {
    expect(() => requirePermission("manager", "project:manage_all")).toThrow(
      /Forbidden.*manager.*project:manage_all/
    );
  });

  it("should throw for viewer trying to cast a vote", () => {
    expect(() => requirePermission("viewer", "vote:cast")).toThrow(
      /Forbidden.*viewer.*vote:cast/
    );
  });

  it("should throw for member trying to manage users", () => {
    expect(() => requirePermission("member", "user:manage")).toThrow(
      /Forbidden.*member.*user:manage/
    );
  });

  it("should throw an Error instance", () => {
    expect(() => requirePermission("viewer", "project:create")).toThrow(Error);
  });

  it("should include role name in the error message", () => {
    try {
      requirePermission("viewer", "vote:cast");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("viewer");
    }
  });

  it("should include permission name in the error message", () => {
    try {
      requirePermission("viewer", "vote:cast");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("vote:cast");
    }
  });
});

// ---------------------------------------------------------------------------
// canModifyResource
// ---------------------------------------------------------------------------

describe("canModifyResource", () => {
  const userId = "user-123";
  const otherUserId = "user-456";

  it("should return true for admin with the permission, regardless of ownership", () => {
    expect(
      canModifyResource("admin", "project:update", otherUserId, userId)
    ).toBe(true);
  });

  it("should return true for manager who owns the resource and has the permission", () => {
    expect(
      canModifyResource("manager", "project:update", userId, userId)
    ).toBe(true);
  });

  it("should return false for manager who does not own the resource (no manage_all)", () => {
    expect(
      canModifyResource("manager", "project:update", otherUserId, userId)
    ).toBe(false);
  });

  it("should return false for member who lacks the permission entirely", () => {
    expect(
      canModifyResource("member", "project:update", userId, userId)
    ).toBe(false);
  });

  it("should return true for member who owns and has proposal:create", () => {
    expect(
      canModifyResource("member", "proposal:create", userId, userId)
    ).toBe(true);
  });

  it("should return false for member who has the permission but does not own the resource", () => {
    expect(
      canModifyResource("member", "proposal:create", otherUserId, userId)
    ).toBe(false);
  });

  it("should return false for viewer for any write permission", () => {
    expect(
      canModifyResource("viewer", "project:create", userId, userId)
    ).toBe(false);
  });

  it("should return false for viewer even as owner if permission is missing", () => {
    expect(
      canModifyResource("viewer", "proposal:create", userId, userId)
    ).toBe(false);
  });

  it("should return true for admin with proposal:delete on non-owned resource", () => {
    expect(
      canModifyResource("admin", "proposal:delete", otherUserId, userId)
    ).toBe(true);
  });

  it("should return false when resourceOwnerId is null for non-admin", () => {
    expect(
      canModifyResource("member", "proposal:create", null, userId)
    ).toBe(false);
  });

  it("should return true when resourceOwnerId is null for admin", () => {
    expect(
      canModifyResource("admin", "proposal:create", null, userId)
    ).toBe(true);
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
