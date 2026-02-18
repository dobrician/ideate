import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

function emptyChain() {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
}

const mockDbSelect = vi.fn(emptyChain);
const mockInsert = vi.fn();
const mockDeleteFn = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      const valuesResult = Promise.resolve([{ id: "team-1", name: "Test", slug: "test" }]);
      Object.assign(valuesResult, {
        returning: vi.fn().mockResolvedValue([{ id: "team-1", name: "Test", slug: "test" }]),
      });
      return { values: vi.fn().mockReturnValue(valuesResult) };
    },
    delete: (...args: unknown[]) => {
      mockDeleteFn(...args);
      return { where: vi.fn().mockResolvedValue(undefined) };
    },
  },
}));

vi.mock("@/db/schema", () => ({
  teams: { id: "teams.id", slug: "teams.slug" },
  teamMembers: { teamId: "tm.teamId", userId: "tm.userId" },
  users: { email: "users.email" },
}));

import { createTeam, deleteTeam, addTeamMember, removeTeamMember } from "@/app/admin/team-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSelect.mockImplementation(emptyChain);
});

const adminUser = { id: "u1", email: "admin@test.com", role: "admin" as const };

describe("createTeam", () => {
  it("returns error when user is not admin", async () => {
    mockRequireAuth.mockResolvedValue({ ...adminUser, role: "member" });
    const result = await createTeam("MyTeam", "desc", "csrf");
    expect(result.error).toBe("Only admins can create teams");
  });

  it("returns error for empty name", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await createTeam("", "desc", "csrf");
    expect(result.error).toBe("Team name is required");
  });

  it("returns error for invalid slug (special chars only)", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await createTeam("!!!!", "desc", "csrf");
    expect(result.error).toBe("Invalid team name");
  });

  it("creates team successfully", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await createTeam("My Team", "A great team", "csrf");
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

describe("deleteTeam", () => {
  it("returns error when user is not admin", async () => {
    mockRequireAuth.mockResolvedValue({ ...adminUser, role: "viewer" });
    const result = await deleteTeam("team-1", "csrf");
    expect(result.error).toBe("Only admins can delete teams");
  });

  it("deletes team successfully", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await deleteTeam("team-1", "csrf");
    expect(result.success).toBe(true);
    expect(mockDeleteFn).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

describe("addTeamMember", () => {
  it("returns error when user is not admin", async () => {
    mockRequireAuth.mockResolvedValue({ ...adminUser, role: "member" });
    const result = await addTeamMember("team-1", "user@test.com", "member", "csrf");
    expect(result.error).toBe("Only admins can manage team members");
  });

  it("returns error for empty email", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await addTeamMember("team-1", "", "member", "csrf");
    expect(result.error).toBe("Email is required");
  });

  it("returns user not found when email unknown", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await addTeamMember("team-1", "unknown@test.com", "member", "csrf");
    expect(result.error).toBe("User not found");
  });

  it("adds member successfully", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            callCount++;
            if (callCount === 1) return Promise.resolve([{ id: "u2", email: "user@test.com" }]);
            return Promise.resolve([]);
          },
        }),
      }),
    }));
    const result = await addTeamMember("team-1", "user@test.com", "member", "csrf");
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns error when user already a member", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    mockDbSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "u2", email: "user@test.com" }]),
        }),
      }),
    }));
    const result = await addTeamMember("team-1", "user@test.com", "member", "csrf");
    expect(result.error).toBe("User is already a member");
  });
});

describe("removeTeamMember", () => {
  it("returns error when user is not admin", async () => {
    mockRequireAuth.mockResolvedValue({ ...adminUser, role: "viewer" });
    const result = await removeTeamMember("team-1", "u2", "csrf");
    expect(result.error).toBe("Only admins can manage team members");
  });

  it("removes member successfully", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const result = await removeTeamMember("team-1", "u2", "csrf");
    expect(result.success).toBe(true);
    expect(mockDeleteFn).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});
