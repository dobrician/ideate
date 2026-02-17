import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelectWhere(),
        }),
      }),
    }),
  },
}));

import { isProjectArchived } from "@/lib/project-utils";

describe("isProjectArchived", () => {
  beforeEach(() => {
    mockSelectWhere.mockReset();
  });

  it("returns true for archived project", async () => {
    mockSelectWhere.mockReturnValue([{ status: "archived" }]);
    expect(await isProjectArchived("proj-1")).toBe(true);
  });

  it("returns false for active project", async () => {
    mockSelectWhere.mockReturnValue([{ status: "active" }]);
    expect(await isProjectArchived("proj-1")).toBe(false);
  });

  it("returns false for draft project", async () => {
    mockSelectWhere.mockReturnValue([{ status: "draft" }]);
    expect(await isProjectArchived("proj-1")).toBe(false);
  });

  it("returns false for non-existent project", async () => {
    mockSelectWhere.mockReturnValue([]);
    expect(await isProjectArchived("unknown")).toBe(false);
  });
});
