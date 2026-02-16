/**
 * Unit tests for project summary generation (src/lib/project-summary.ts).
 * Mocks LLM layer and database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  projects: {
    id: "id",
    title: "title",
    description: "description",
    summary: "summary",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { completeWithFallback } from "@/lib/llm";
import { db } from "@/db";

const mockedComplete = vi.mocked(completeWithFallback);
const mockedDb = vi.mocked(db);

// Chain builder for drizzle query
function mockSelect(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(rows),
        }),
      }),
    }),
  };
  Object.assign(mockedDb, chain);
  return chain;
}

function mockUpdate() {
  const chain = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  Object.assign(mockedDb, chain);
  return chain;
}

describe("generateProjectSummary", () => {
  beforeEach(() => {
    vi.resetModules();
    mockedComplete.mockReset();
  });

  it("should return null when project not found", async () => {
    mockSelect([]);
    const { generateProjectSummary } = await import("@/lib/project-summary");

    const result = await generateProjectSummary("nonexistent-id");
    expect(result).toBeNull();
  });

  it("should return existing summary when not forced", async () => {
    mockSelect([{
      id: "p1",
      title: "Test Project",
      description: "A description",
      summary: "Existing summary",
    }]);
    const { generateProjectSummary } = await import("@/lib/project-summary");

    const result = await generateProjectSummary("p1");
    expect(result).toBe("Existing summary");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should regenerate when force=true even if summary exists", async () => {
    mockSelect([{
      id: "p1",
      title: "Test Project",
      description: "A description",
      summary: "Old summary",
    }]);
    mockUpdate();

    mockedComplete.mockResolvedValue({
      text: "New AI summary",
      modelUsed: "gemini",
    });

    const { generateProjectSummary } = await import("@/lib/project-summary");
    const result = await generateProjectSummary("p1", { force: true });

    expect(result).toBe("New AI summary");
    expect(mockedComplete).toHaveBeenCalledOnce();
  });

  it("should use fallback when description is null", async () => {
    mockSelect([{
      id: "p2",
      title: "Title Only Project",
      description: null,
      summary: null,
    }]);

    const { generateProjectSummary } = await import("@/lib/project-summary");
    const result = await generateProjectSummary("p2");

    expect(result).toBe("Title Only Project");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should fall back to description when LLM returns null", async () => {
    mockSelect([{
      id: "p3",
      title: "Project",
      description: "Fallback description text",
      summary: null,
    }]);
    mockUpdate();

    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const { generateProjectSummary } = await import("@/lib/project-summary");
    const result = await generateProjectSummary("p3");

    expect(result).toBe("Fallback description text");
  });

  it("should include ideator prompt keywords in the LLM call", async () => {
    mockSelect([{
      id: "p4",
      title: "My Project",
      description: "Collect feedback on features",
      summary: null,
    }]);
    mockUpdate();

    mockedComplete.mockResolvedValue({ text: "A summary", modelUsed: "gemini" });

    const { generateProjectSummary } = await import("@/lib/project-summary");
    await generateProjectSummary("p4");

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("terse noun-phrase summary");
    expect(prompt).toContain("My Project");
    expect(prompt).toContain("Collect feedback on features");
  });
});
