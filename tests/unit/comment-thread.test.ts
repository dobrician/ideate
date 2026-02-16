import { describe, it, expect } from "vitest";
import {
  buildCommentTree,
  formatTimeAgo,
  getInitials,
  avatarColor,
} from "@/components/comment-thread";
import type { Comment } from "@/components/comment-thread";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    content: "hello",
    parentId: null,
    userId: "u1",
    createdAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  buildCommentTree                                                   */
/* ------------------------------------------------------------------ */
describe("buildCommentTree", () => {
  it("returns empty array for no comments", () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it("sorts comments oldest-first", () => {
    const comments: Comment[] = [
      makeComment({ id: "c2", createdAt: new Date("2026-01-16T00:00:00Z") }),
      makeComment({ id: "c1", createdAt: new Date("2026-01-15T00:00:00Z") }),
      makeComment({ id: "c3", createdAt: new Date("2026-01-17T00:00:00Z") }),
    ];
    const sorted = buildCommentTree(comments);
    expect(sorted.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("handles null createdAt (sorts to beginning)", () => {
    const comments: Comment[] = [
      makeComment({ id: "c2", createdAt: new Date("2026-01-15T00:00:00Z") }),
      makeComment({ id: "c1", createdAt: null }),
    ];
    const sorted = buildCommentTree(comments);
    expect(sorted[0].id).toBe("c1");
  });

  it("does not mutate the original array", () => {
    const comments: Comment[] = [
      makeComment({ id: "c2", createdAt: new Date("2026-01-16T00:00:00Z") }),
      makeComment({ id: "c1", createdAt: new Date("2026-01-15T00:00:00Z") }),
    ];
    const originalOrder = comments.map((c) => c.id);
    buildCommentTree(comments);
    expect(comments.map((c) => c.id)).toEqual(originalOrder);
  });

  it("preserves order for equal timestamps", () => {
    const ts = new Date("2026-01-15T00:00:00Z");
    const comments: Comment[] = [
      makeComment({ id: "a", createdAt: ts }),
      makeComment({ id: "b", createdAt: ts }),
    ];
    const sorted = buildCommentTree(comments);
    expect(sorted.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

/* ------------------------------------------------------------------ */
/*  formatTimeAgo                                                      */
/* ------------------------------------------------------------------ */
describe("formatTimeAgo", () => {
  const calls: Array<{ key: string; vars?: Record<string, string | number> }> = [];
  const mockT = (key: string, vars?: Record<string, string | number>) => {
    calls.push({ key, vars });
    return `${key}${vars ? JSON.stringify(vars) : ""}`;
  };

  beforeEach(() => {
    calls.length = 0;
  });

  it('returns "just now" for recent timestamps', () => {
    const now = new Date();
    formatTimeAgo(now, mockT);
    expect(calls[0].key).toBe("time.justNow");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    formatTimeAgo(fiveMinAgo, mockT);
    expect(calls[0].key).toBe("time.minutesAgo");
    expect(calls[0].vars).toEqual({ count: 5 });
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    formatTimeAgo(twoHoursAgo, mockT);
    expect(calls[0].key).toBe("time.hoursAgo");
    expect(calls[0].vars).toEqual({ count: 2 });
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000);
    formatTimeAgo(threeDaysAgo, mockT);
    expect(calls[0].key).toBe("time.daysAgo");
    expect(calls[0].vars).toEqual({ count: 3 });
  });

  it("returns days for very old timestamps", () => {
    const longAgo = new Date(Date.now() - 30 * 86400_000);
    formatTimeAgo(longAgo, mockT);
    expect(calls[0].key).toBe("time.daysAgo");
    expect(calls[0].vars).toEqual({ count: 30 });
  });

  it("handles 59 minutes correctly (not hours)", () => {
    const fiftyNineMin = new Date(Date.now() - 59 * 60_000);
    formatTimeAgo(fiftyNineMin, mockT);
    expect(calls[0].key).toBe("time.minutesAgo");
    expect(calls[0].vars).toEqual({ count: 59 });
  });
});

/* ------------------------------------------------------------------ */
/*  getInitials                                                        */
/* ------------------------------------------------------------------ */
describe("getInitials", () => {
  it("returns single initial for one word", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("returns two initials for two words", () => {
    expect(getInitials("Alice Smith")).toBe("AS");
  });

  it("returns at most two initials", () => {
    expect(getInitials("John Michael Smith")).toBe("JM");
  });

  it("returns uppercase initials", () => {
    expect(getInitials("alice smith")).toBe("AS");
  });

  it("handles extra whitespace between words", () => {
    expect(getInitials("Alice   Smith")).toBe("AS");
  });

  it("handles email-like strings", () => {
    expect(getInitials("alice@test.com")).toBe("A");
  });
});

/* ------------------------------------------------------------------ */
/*  avatarColor                                                        */
/* ------------------------------------------------------------------ */
describe("avatarColor", () => {
  it("returns first color for null userId", () => {
    expect(avatarColor(null)).toBe("bg-blue-600");
  });

  it("returns a valid color class for any userId", () => {
    const validColors = [
      "bg-blue-600", "bg-emerald-600", "bg-violet-600",
      "bg-amber-600", "bg-rose-600", "bg-cyan-600",
      "bg-pink-600", "bg-indigo-600",
    ];
    const color = avatarColor("user-abc-123");
    expect(validColors).toContain(color);
  });

  it("returns deterministic color for same userId", () => {
    expect(avatarColor("user-1")).toBe(avatarColor("user-1"));
  });

  it("produces different colors for different userIds", () => {
    // Not guaranteed but statistically very likely for these inputs
    const colors = new Set(
      ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"].map(avatarColor)
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("handles empty string userId", () => {
    const validColors = [
      "bg-blue-600", "bg-emerald-600", "bg-violet-600",
      "bg-amber-600", "bg-rose-600", "bg-cyan-600",
      "bg-pink-600", "bg-indigo-600",
    ];
    expect(validColors).toContain(avatarColor(""));
  });
});
