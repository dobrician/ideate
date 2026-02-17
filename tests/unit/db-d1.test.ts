import { describe, it, expect, vi } from "vitest";

// Mock drizzle-orm/d1 before importing
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({ query: {}, select: vi.fn() })),
}));

import { createD1Database } from "@/db/d1";
import { drizzle } from "drizzle-orm/d1";

describe("createD1Database", () => {
  it("creates a Drizzle instance from a D1 binding", () => {
    const mockD1 = {} as D1Database;
    const db = createD1Database(mockD1);
    expect(drizzle).toHaveBeenCalledWith(mockD1, expect.objectContaining({
      schema: expect.any(Object),
    }));
    expect(db).toBeDefined();
  });

  it("passes the schema to drizzle", () => {
    const mockD1 = {} as D1Database;
    createD1Database(mockD1);
    const call = vi.mocked(drizzle).mock.calls[0];
    expect(call[1]).toHaveProperty("schema");
    const schema = call[1]!.schema as Record<string, unknown>;
    expect(schema).toHaveProperty("users");
    expect(schema).toHaveProperty("projects");
    expect(schema).toHaveProperty("proposals");
    expect(schema).toHaveProperty("votes");
  });

  it("returns an object with query capabilities", () => {
    const mockD1 = {} as D1Database;
    const db = createD1Database(mockD1);
    expect(db).toHaveProperty("query");
  });
});
