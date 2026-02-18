import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string; email: string; firstName: string | null; lastName: string | null;
  avatarUrl: string | null; role: "admin" | "manager" | "member" | "viewer";
  createdAt: Date | null; updatedAt: Date | null;
}

const mockRevalidate = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => mockRevalidate(...a) }));
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { mockRedirect(url); throw new Error(`NEXT_REDIRECT:${url}`); },
}));
const mockAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => mockAuth(...a) }));
vi.mock("@/lib/csrf", () => ({ requireCsrfToken: vi.fn().mockResolvedValue(undefined) }));
const mockFireWebhook = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks", () => ({ fireWebhookEvent: (...a: unknown[]) => mockFireWebhook(...a) }));

const mockInsert = vi.fn(), mockSet = vi.fn(), mockSetWhere = vi.fn();
const mockDelWhere = vi.fn(), mockSelLim = vi.fn();
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: (...a: unknown[]) => { mockInsert(...a); return Promise.resolve(); } }),
    update: () => ({ set: (...a: unknown[]) => { mockSet(...a); return { where: (...w: unknown[]) => { mockSetWhere(...w); return Promise.resolve(); } }; } }),
    delete: () => ({ where: (...a: unknown[]) => { mockDelWhere(...a); return Promise.resolve(); } }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockSelLim() }) }) }),
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) }));
vi.mock("@/lib/request-utils", () => ({ getActionClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));

const mkUser = (o: Partial<MockUser> = {}): MockUser => ({
  id: "user-1", email: "a@t.com", firstName: "A", lastName: "T",
  avatarUrl: null, role: "member", createdAt: new Date(), updatedAt: new Date(), ...o,
});
const mkFD = (e: Record<string, string>) => {
  const fd = new FormData(); Object.entries(e).forEach(([k, v]) => fd.set(k, v)); return fd;
};
const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const ownedProj = { id: "proj-1", title: "Old", description: null, deadline: new Date(), status: "active", userId: "user-1", summary: null, createdAt: new Date(), updatedAt: new Date() };

import { createProject, updateProject, deleteProject, unarchiveProject } from "@/app/projects/actions";

beforeEach(() => {
  [mockRevalidate, mockRedirect, mockInsert, mockSet, mockSetWhere, mockDelWhere, mockSelLim, mockFireWebhook].forEach(m => m.mockReset());
  mockFireWebhook.mockResolvedValue(undefined);
  mockAuth.mockReset().mockResolvedValue(mkUser());
  mockSelLim.mockResolvedValue([]);
});

describe("createProject", () => {
  const vfd = () => mkFD({ title: "Test Project", description: "Good desc", deadline: futureDate, status: "active" });

  it("rejects unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await createProject(vfd())).toEqual({ error: "error.mustBeLoggedIn" });
  });
  it("rejects viewers", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await createProject(vfd())).toEqual({ error: "error.noPermission" });
  });
  it("rejects short title", async () => {
    expect(await createProject(mkFD({ title: "Hi", description: "", deadline: futureDate }))).toEqual({ error: "Title must be at least 3 characters" });
  });
  it("rejects past deadline", async () => {
    expect(await createProject(mkFD({ title: "Valid", description: "", deadline: "2020-01-01" }))).toEqual({ error: "Deadline must be a valid future date" });
  });
  it("creates and redirects", async () => {
    await expect(createProject(vfd())).rejects.toThrow("NEXT_REDIRECT");
    const v = mockInsert.mock.calls[0][0] as { title: string; status: string; userId: string };
    expect(v.title).toBe("Test Project");
    expect(v.status).toBe("active");
    expect(v.userId).toBe("user-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/projects");
  });
  it("stores null when description is empty", async () => {
    await expect(createProject(mkFD({ title: "No Desc", description: "", deadline: futureDate }))).rejects.toThrow("NEXT_REDIRECT");
    expect((mockInsert.mock.calls[0][0] as { description: string | null }).description).toBeNull();
  });
  it("returns generic error on DB failure", async () => {
    mockInsert.mockImplementation(() => { throw new Error("DB"); });
    expect(await createProject(vfd())).toEqual({ error: "error.unexpected" });
  });
  it("succeeds even when webhook rejects", async () => {
    mockFireWebhook.mockRejectedValue(new Error("webhook down"));
    await expect(createProject(vfd())).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("updateProject", () => {
  const vfd = () => mkFD({ title: "Updated", description: "Desc", deadline: futureDate, status: "active" });
  beforeEach(() => { mockAuth.mockResolvedValue(mkUser({ role: "manager" })); });

  it("rejects unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await updateProject("p1", vfd())).toEqual({ error: "error.mustBeLoggedIn" });
  });
  it("rejects viewers", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await updateProject("p1", vfd())).toEqual({ error: "error.noPermission" });
  });
  it("rejects short title", async () => {
    expect(await updateProject("p1", mkFD({ title: "Hi", description: "", deadline: futureDate }))).toEqual({ error: "Title must be at least 3 characters" });
  });
  it("returns not found", async () => {
    mockSelLim.mockResolvedValueOnce([]);
    expect(await updateProject("p1", vfd())).toEqual({ error: "Project not found" });
  });
  it("rejects non-owner", async () => {
    mockSelLim.mockResolvedValueOnce([{ ...ownedProj, userId: "other" }]);
    expect(await updateProject("p1", vfd())).toEqual({ error: "You don't have permission to update this project" });
  });
  it("updates owned project", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    expect(await updateProject("p1", vfd())).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalled();
    expect(mockRevalidate).toHaveBeenCalledWith("/projects/p1");
  });
  it("allows admin to update any", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([{ ...ownedProj, userId: "other" }]);
    expect(await updateProject("p1", vfd())).toEqual({ success: true });
  });
  it("stores null when description is empty", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    expect(await updateProject("p1", mkFD({ title: "Upd", description: "", deadline: futureDate }))).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });
  it("fires webhook on archive", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    expect(await updateProject("p1", mkFD({ title: "Upd", description: "d", deadline: futureDate, status: "archived" }))).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
  });
  it("succeeds even when archive webhook rejects", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    mockFireWebhook.mockRejectedValue(new Error("webhook down"));
    expect(await updateProject("p1", mkFD({ title: "Upd", description: "d", deadline: futureDate, status: "archived" }))).toEqual({ success: true });
  });
  it("returns generic error on DB failure", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    mockSet.mockImplementation(() => { throw new Error("DB"); });
    expect(await updateProject("p1", vfd())).toEqual({ error: "error.unexpected" });
  });
});

describe("deleteProject", () => {
  beforeEach(() => { mockAuth.mockResolvedValue(mkUser({ role: "manager" })); });

  it("rejects unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await deleteProject("p1", "t")).toEqual({ error: "error.mustBeLoggedIn" });
  });
  it("rejects viewers", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await deleteProject("p1", "t")).toEqual({ error: "error.noPermission" });
  });
  it("returns not found", async () => {
    mockSelLim.mockResolvedValueOnce([]);
    expect(await deleteProject("p1", "t")).toEqual({ error: "Project not found" });
  });
  it("rejects non-owner", async () => {
    mockSelLim.mockResolvedValueOnce([{ ...ownedProj, userId: "other" }]);
    expect(await deleteProject("p1", "t")).toEqual({ error: "You don't have permission to delete this project" });
  });
  it("deletes and redirects", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    await expect(deleteProject("p1", "t")).rejects.toThrow("NEXT_REDIRECT");
    expect(mockDelWhere).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/projects");
  });
  it("allows admin to delete any", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([{ ...ownedProj, userId: "other" }]);
    await expect(deleteProject("p1", "t")).rejects.toThrow("NEXT_REDIRECT");
  });
  it("returns generic error on DB failure", async () => {
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    mockDelWhere.mockImplementation(() => { throw new Error("DB"); });
    expect(await deleteProject("p1", "t")).toEqual({ error: "error.unexpected" });
  });
});

describe("unarchiveProject", () => {
  const archived = { ...ownedProj, status: "archived" };

  it("rejects non-admin", async () => {
    expect(await unarchiveProject("p1", "t")).toEqual({ error: "error.noPermission" });
  });
  it("returns not found", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([]);
    expect(await unarchiveProject("p1", "t")).toEqual({ error: "Project not found" });
  });
  it("rejects non-archived", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([ownedProj]);
    expect(await unarchiveProject("p1", "t")).toEqual({ error: "Project is not archived" });
  });
  it("unarchives as admin", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([archived]);
    expect(await unarchiveProject("p1", "t")).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
  it("rejects unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await unarchiveProject("p1", "t")).toEqual({ error: "error.mustBeLoggedIn" });
  });
  it("returns generic error on DB failure", async () => {
    mockAuth.mockResolvedValue(mkUser({ role: "admin" }));
    mockSelLim.mockResolvedValueOnce([archived]);
    mockSet.mockImplementation(() => { throw new Error("DB"); });
    expect(await unarchiveProject("p1", "t")).toEqual({ error: "error.unexpected" });
  });
});
