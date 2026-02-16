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

interface ProjectInsertValues {
  id: string;
  title: string;
  description: string | null;
  deadline: Date;
  status: string;
  userId: string;
}

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...wArgs: unknown[]) => {
            mockUpdateWhere(...wArgs);
            return Promise.resolve();
          },
        };
      },
    }),
    delete: () => ({
      where: (...args: unknown[]) => {
        mockDeleteWhere(...args);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => mockSelectLimit() }),
      }),
    }),
  },
}));

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "alice@test.com",
    firstName: "Alice",
    lastName: "Test",
    avatarUrl: null,
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const futureDate = new Date(Date.now() + 7 * 86400000)
  .toISOString()
  .split("T")[0];

import {
  createProject,
  updateProject,
  deleteProject,
} from "@/app/projects/actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRedirect.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockReset();
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockReset();
  mockDeleteWhere.mockReset();
  mockSelectLimit.mockReset();
  mockRequireAuth.mockResolvedValue(makeUser());
  mockSelectLimit.mockResolvedValue([]);
});

describe("createProject", () => {
  const validForm = () =>
    makeFormData({
      title: "Test Project",
      description: "A good description",
      deadline: futureDate,
      status: "active",
    });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    await expect(createProject(validForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await createProject(validForm());
    expect(r).toEqual({
      error: "You don't have permission to create projects",
    });
  });

  it("rejects short title", async () => {
    const fd = makeFormData({
      title: "Hi",
      description: "",
      deadline: futureDate,
    });
    const r = await createProject(fd);
    expect(r).toEqual({ error: "Title must be at least 3 characters" });
  });

  it("rejects past deadline", async () => {
    const fd = makeFormData({
      title: "Valid Title",
      description: "",
      deadline: "2020-01-01",
    });
    const r = await createProject(fd);
    expect(r).toEqual({ error: "Deadline must be a valid future date" });
  });

  it("creates project and redirects", async () => {
    await expect(createProject(validForm())).rejects.toThrow("NEXT_REDIRECT");
    const v = mockInsertValues.mock.calls[0][0] as ProjectInsertValues;
    expect(v.title).toBe("Test Project");
    expect(v.status).toBe("active");
    expect(v.userId).toBe("user-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });

  it("returns generic error on DB failure", async () => {
    mockInsertValues.mockImplementation(() => {
      throw new Error("DB down");
    });
    const r = await createProject(validForm());
    expect(r).toEqual({
      error: "Failed to create project. Please try again.",
    });
  });
});

describe("updateProject", () => {
  const validForm = () =>
    makeFormData({
      title: "Updated Title",
      description: "Updated desc",
      deadline: futureDate,
      status: "active",
    });

  const ownedProject = {
    id: "proj-1",
    title: "Old",
    description: null,
    deadline: new Date(),
    status: "active",
    userId: "user-1",
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // manager role has project:update permission
    mockRequireAuth.mockResolvedValue(makeUser({ role: "manager" }));
  });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    await expect(updateProject("proj-1", validForm())).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({
      error: "You don't have permission to update projects",
    });
  });

  it("rejects short title", async () => {
    const fd = makeFormData({
      title: "Hi",
      description: "",
      deadline: futureDate,
    });
    const r = await updateProject("proj-1", fd);
    expect(r).toEqual({ error: "Title must be at least 3 characters" });
  });

  it("returns not found for missing project", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({ error: "Project not found" });
  });

  it("rejects non-owner", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { ...ownedProject, userId: "other-user" },
    ]);
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({
      error: "You don't have permission to update this project",
    });
  });

  it("updates owned project", async () => {
    mockSelectLimit.mockResolvedValueOnce([ownedProject]);
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({ success: true });
    expect(mockUpdateSet).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });

  it("allows admin to update any project", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "admin" }));
    mockSelectLimit.mockResolvedValueOnce([
      { ...ownedProject, userId: "other" },
    ]);
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({ success: true });
  });

  it("returns generic error on DB failure", async () => {
    mockSelectLimit.mockResolvedValueOnce([ownedProject]);
    mockUpdateSet.mockImplementation(() => {
      throw new Error("DB down");
    });
    const r = await updateProject("proj-1", validForm());
    expect(r).toEqual({
      error: "Failed to update project. Please try again.",
    });
  });
});

describe("deleteProject", () => {
  const ownedProject = {
    id: "proj-1",
    title: "Old",
    description: null,
    deadline: new Date(),
    status: "active",
    userId: "user-1",
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // manager role has project:delete permission
    mockRequireAuth.mockResolvedValue(makeUser({ role: "manager" }));
  });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    await expect(deleteProject("proj-1", "token")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await deleteProject("proj-1", "token");
    expect(r).toEqual({
      error: "You don't have permission to delete projects",
    });
  });

  it("returns not found for missing project", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const r = await deleteProject("proj-1", "token");
    expect(r).toEqual({ error: "Project not found" });
  });

  it("rejects non-owner", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { ...ownedProject, userId: "other" },
    ]);
    const r = await deleteProject("proj-1", "token");
    expect(r).toEqual({
      error: "You don't have permission to delete this project",
    });
  });

  it("deletes owned project and redirects", async () => {
    mockSelectLimit.mockResolvedValueOnce([ownedProject]);
    await expect(deleteProject("proj-1", "token")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
    expect(mockRedirect).toHaveBeenCalledWith("/projects");
  });

  it("allows admin to delete any project", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "admin" }));
    mockSelectLimit.mockResolvedValueOnce([
      { ...ownedProject, userId: "other" },
    ]);
    await expect(deleteProject("proj-1", "token")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("returns generic error on DB failure", async () => {
    mockSelectLimit.mockResolvedValueOnce([ownedProject]);
    mockDeleteWhere.mockImplementation(() => {
      throw new Error("DB down");
    });
    const r = await deleteProject("proj-1", "token");
    expect(r).toEqual({
      error: "Failed to delete project. Please try again.",
    });
  });
});
