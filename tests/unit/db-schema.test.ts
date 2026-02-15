import { describe, it, expect } from "vitest";
import * as schema from "@/db/schema";

describe("database schema", () => {
  it("exports all required tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.proposals).toBeDefined();
    expect(schema.votes).toBeDefined();
    expect(schema.comments).toBeDefined();
  });
});
