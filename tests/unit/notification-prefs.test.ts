import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "member" | "viewer";
  passwordHash: string | null;
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

vi.mock("@/lib/password", () => ({
  validatePassword: vi.fn().mockReturnValue({ valid: true }),
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return {
          onConflictDoUpdate: (...cuArgs: unknown[]) => {
            mockOnConflictDoUpdate(...cuArgs);
            return Promise.resolve();
          },
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    select: () => ({
      from: (...args: unknown[]) => {
        mockSelectFrom(...args);
        return {
          where: (...wArgs: unknown[]) => {
            mockSelectWhere(...wArgs);
            return {
              limit: () => mockSelectLimit(),
            };
          },
        };
      },
    }),
  },
}));

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "test@test.com",
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    role: "member",
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

import { updateNotificationPreferences } from "@/app/profile/actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockReset();
  mockOnConflictDoUpdate.mockReset();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockReset();
  mockRequireAuth.mockResolvedValue(makeUser());
});

describe("updateNotificationPreferences", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await updateNotificationPreferences(
      { emailNewProposal: true, emailVoteOnMine: true, emailCommentReply: true, emailWeeklyDigest: false },
      "csrf"
    );
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("saves preferences with upsert", async () => {
    const r = await updateNotificationPreferences(
      { emailNewProposal: false, emailVoteOnMine: true, emailCommentReply: false, emailWeeklyDigest: false },
      "csrf"
    );
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        emailNewProposal: false,
        emailVoteOnMine: true,
        emailCommentReply: false,
      })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("saves all-enabled preferences", async () => {
    const r = await updateNotificationPreferences(
      { emailNewProposal: true, emailVoteOnMine: true, emailCommentReply: true, emailWeeklyDigest: false },
      "csrf"
    );
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNewProposal: true,
        emailVoteOnMine: true,
        emailCommentReply: true,
      })
    );
  });

  it("saves all-disabled preferences", async () => {
    const r = await updateNotificationPreferences(
      { emailNewProposal: false, emailVoteOnMine: false, emailCommentReply: false, emailWeeklyDigest: false },
      "csrf"
    );
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNewProposal: false,
        emailVoteOnMine: false,
        emailCommentReply: false,
      })
    );
  });
});

describe("getUserNotificationPref", () => {
  it("returns true when no preferences exist", async () => {
    mockSelectLimit.mockResolvedValue([]);
    const { getUserNotificationPref } = await import("@/lib/notifications");
    const result = await getUserNotificationPref("user-1", "emailVoteOnMine");
    expect(result).toBe(true);
  });

  it("returns stored preference value", async () => {
    mockSelectLimit.mockResolvedValue([
      { emailNewProposal: true, emailVoteOnMine: false, emailCommentReply: true, emailWeeklyDigest: false },
    ]);
    const { getUserNotificationPref } = await import("@/lib/notifications");
    const result = await getUserNotificationPref("user-1", "emailVoteOnMine");
    expect(result).toBe(false);
  });
});

describe("notificationPreferences schema", () => {
  it("exports notificationPreferences table from schema", async () => {
    const schema = await vi.importActual<Record<string, unknown>>("@/db/schema");
    expect(schema.notificationPreferences).toBeDefined();
  });
});
