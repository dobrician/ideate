import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "member" | "viewer";
  createdAt: Date | null;
  updatedAt: Date | null;
}

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteFn = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockUpdateSet(...sArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockUpdateWhere(...wArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDeleteFn(...args);
      return {
        where: (...wArgs: unknown[]) => {
          mockDeleteWhere(...wArgs);
          return Promise.resolve();
        },
      };
    },
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  },
}));

function makeAdmin(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "admin-1",
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    avatarUrl: null,
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

import {
  bulkUpdateUserRole,
  bulkDeleteUsers,
} from "@/app/admin/user-actions";
import {
  bulkArchiveProjects,
  bulkDeleteProjects,
} from "@/app/admin/project-actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  mockDeleteFn.mockClear();
  mockDeleteWhere.mockClear();
  mockRequireAuth.mockResolvedValue(makeAdmin());
});

describe("bulkUpdateUserRole", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await bulkUpdateUserRole(["u1"], "member", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "member" }));
    const r = await bulkUpdateUserRole(["u1"], "member", "csrf");
    expect(r).toEqual({ error: "You don't have permission to manage users" });
  });

  it("rejects invalid role", async () => {
    const r = await bulkUpdateUserRole(["u1"], "superadmin", "csrf");
    expect(r).toEqual({ error: "Invalid role" });
  });

  it("rejects empty user list", async () => {
    const r = await bulkUpdateUserRole([], "member", "csrf");
    expect(r).toEqual({ error: "No users selected" });
  });

  it("filters out self from bulk update", async () => {
    const r = await bulkUpdateUserRole(["admin-1"], "viewer", "csrf");
    expect(r).toEqual({ error: "You cannot change your own role" });
  });

  it("updates multiple users", async () => {
    const r = await bulkUpdateUserRole(["u1", "u2", "u3"], "viewer", "csrf");
    expect(r).toEqual({ success: true, count: 3 });
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("excludes self from mixed list", async () => {
    const r = await bulkUpdateUserRole(["admin-1", "u2"], "viewer", "csrf");
    expect(r).toEqual({ success: true, count: 1 });
  });
});

describe("bulkDeleteUsers", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await bulkDeleteUsers(["u1"], "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "member" }));
    const r = await bulkDeleteUsers(["u1"], "csrf");
    expect(r).toEqual({ error: "You don't have permission to manage users" });
  });

  it("rejects empty user list", async () => {
    const r = await bulkDeleteUsers([], "csrf");
    expect(r).toEqual({ error: "No users selected" });
  });

  it("prevents self-deletion", async () => {
    const r = await bulkDeleteUsers(["admin-1"], "csrf");
    expect(r).toEqual({ error: "You cannot delete yourself" });
  });

  it("deletes multiple users", async () => {
    const r = await bulkDeleteUsers(["u1", "u2"], "csrf");
    expect(r).toEqual({ success: true, count: 2 });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

describe("bulkArchiveProjects", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await bulkArchiveProjects(["p1"], "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "manager" }));
    const r = await bulkArchiveProjects(["p1"], "csrf");
    expect(r).toEqual({ error: "Only admins can bulk archive projects" });
  });

  it("rejects empty project list", async () => {
    const r = await bulkArchiveProjects([], "csrf");
    expect(r).toEqual({ error: "No projects selected" });
  });

  it("archives multiple projects", async () => {
    const r = await bulkArchiveProjects(["p1", "p2"], "csrf");
    expect(r).toEqual({ success: true, count: 2 });
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("bulkDeleteProjects", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await bulkDeleteProjects(["p1"], "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "manager" }));
    const r = await bulkDeleteProjects(["p1"], "csrf");
    expect(r).toEqual({ error: "Only admins can bulk delete projects" });
  });

  it("rejects empty project list", async () => {
    const r = await bulkDeleteProjects([], "csrf");
    expect(r).toEqual({ error: "No projects selected" });
  });

  it("deletes multiple projects", async () => {
    const r = await bulkDeleteProjects(["p1", "p2", "p3"], "csrf");
    expect(r).toEqual({ success: true, count: 3 });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});
