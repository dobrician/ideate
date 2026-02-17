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

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockDeleteFn = vi.fn();
const mockDeleteWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockOnConflict = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsertValues(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockInsertValues(...vArgs);
          return {
            returning: (...rArgs: unknown[]) => {
              mockInsertReturning(...rArgs);
              return Promise.resolve([{ id: "tag-1" }]);
            },
            onConflictDoNothing: (...cArgs: unknown[]) => {
              mockOnConflict(...cArgs);
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
    select: () => ({
      from: (...args: unknown[]) => {
        mockSelectFrom(...args);
        return {
          where: (...wArgs: unknown[]) => {
            mockSelectWhere(...wArgs);
            return {
              limit: () => Promise.resolve([]),
              then: (r: (v: unknown[]) => void) => Promise.resolve([]).then(r),
            };
          },
        };
      },
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
  createTag,
  deleteTag,
  addProjectTag,
  removeProjectTag,
} from "@/app/admin/project-actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockClear();
  mockInsertReturning.mockClear();
  mockDeleteFn.mockClear();
  mockDeleteWhere.mockClear();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockOnConflict.mockClear();
  mockRequireAuth.mockResolvedValue(makeAdmin());
});

describe("createTag", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await createTag("Tech", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "member" }));
    const r = await createTag("Tech", "csrf");
    expect(r.error).toBeDefined();
  });

  it("rejects empty name", async () => {
    const r = await createTag("", "csrf");
    expect(r.error).toBeDefined();
  });

  it("rejects name over 50 chars", async () => {
    const r = await createTag("a".repeat(51), "csrf");
    expect(r.error).toBeDefined();
  });

  it("creates a tag successfully", async () => {
    const r = await createTag("Tech", "csrf");
    expect(r.success).toBe(true);
    expect(r.id).toBe("tag-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

describe("deleteTag", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await deleteTag("tag-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects non-admin users", async () => {
    mockRequireAuth.mockResolvedValue(makeAdmin({ role: "member" }));
    const r = await deleteTag("tag-1", "csrf");
    expect(r.error).toBeDefined();
  });

  it("deletes a tag successfully", async () => {
    const r = await deleteTag("tag-1", "csrf");
    expect(r.success).toBe(true);
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

describe("addProjectTag", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await addProjectTag("proj-1", "tag-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("adds a project tag successfully", async () => {
    const r = await addProjectTag("proj-1", "tag-1", "csrf");
    expect(r.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("removeProjectTag", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await removeProjectTag("proj-1", "tag-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("removes a project tag successfully", async () => {
    const r = await removeProjectTag("proj-1", "tag-1", "csrf");
    expect(r.success).toBe(true);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
