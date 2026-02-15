import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Types ──────────────────────────────────────────────────────────────────

/** Minimal user shape returned by requireAuth (matches drizzle InferSelectModel<typeof users>) */
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

/** Shape of values passed to users update .set() */
interface ProfileUpdateSet {
  firstName: string | null;
  lastName: string | null;
  updatedAt: Date;
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn<() => Promise<void>>();

vi.mock("@/db", () => ({
  db: {
    // Use plain arrow functions for chain structure; only leaf fns are vi.fn()
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...whereArgs: unknown[]) => {
            mockUpdateWhere(...whereArgs);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

// ── Test helpers ────────────────────────────────────────────────────────────

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
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Import SUT (after mocks are wired) ─────────────────────────────────────

import { updateProfile } from "@/app/profile/actions";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockClear();

  // Default: authenticated member user
  mockRequireAuth.mockResolvedValue(makeUser());
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("updateProfile", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await updateProfile(makeFormData({ firstName: "Bob" }));

    expect(result).toEqual({ error: "You must be logged in" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return validation error when firstName exceeds 100 characters", async () => {
    const fd = makeFormData({ firstName: "x".repeat(101) });

    const result = await updateProfile(fd);

    expect(result).toEqual({ error: "First name too long" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return validation error when lastName exceeds 100 characters", async () => {
    const fd = makeFormData({ lastName: "y".repeat(101) });

    const result = await updateProfile(fd);

    expect(result).toEqual({ error: "Last name too long" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should update first and last name successfully", async () => {
    const fd = makeFormData({ firstName: "Robert", lastName: "Smith" });

    const result = await updateProfile(fd);

    expect(result).toEqual({ success: true });

    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const setArg = mockUpdateSet.mock.calls[0][0] as ProfileUpdateSet;
    expect(setArg.firstName).toBe("Robert");
    expect(setArg.lastName).toBe("Smith");
    expect(setArg.updatedAt).toBeInstanceOf(Date);

    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("should set firstName to null when field is empty", async () => {
    const fd = makeFormData({ firstName: "", lastName: "Smith" });

    const result = await updateProfile(fd);

    expect(result).toEqual({ success: true });

    const setArg = mockUpdateSet.mock.calls[0][0] as ProfileUpdateSet;
    expect(setArg.firstName).toBeNull();
    expect(setArg.lastName).toBe("Smith");
  });

  it("should set lastName to null when field is empty", async () => {
    const fd = makeFormData({ firstName: "Alice", lastName: "" });

    const result = await updateProfile(fd);

    expect(result).toEqual({ success: true });

    const setArg = mockUpdateSet.mock.calls[0][0] as ProfileUpdateSet;
    expect(setArg.firstName).toBe("Alice");
    expect(setArg.lastName).toBeNull();
  });

  it("should set both names to null when both fields are empty", async () => {
    const fd = makeFormData({});

    const result = await updateProfile(fd);

    expect(result).toEqual({ success: true });

    const setArg = mockUpdateSet.mock.calls[0][0] as ProfileUpdateSet;
    expect(setArg.firstName).toBeNull();
    expect(setArg.lastName).toBeNull();
  });

  it("should return generic error when db operation fails", async () => {
    mockUpdateSet.mockImplementation(() => {
      throw new Error("DB connection lost");
    });

    const fd = makeFormData({ firstName: "Alice" });

    const result = await updateProfile(fd);

    expect(result).toEqual({ error: "Failed to update profile" });
  });

  it("should update profile for the authenticated user only", async () => {
    const specificUser = makeUser({ id: "user-42" });
    mockRequireAuth.mockResolvedValue(specificUser);

    const fd = makeFormData({ firstName: "NewName" });

    await updateProfile(fd);

    // Verify the where clause was invoked (targeting the specific user's row)
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
  });
});
