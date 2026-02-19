import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Database adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_DRIVER;
  });

  it("defaults to sqlite when DATABASE_DRIVER is not set", async () => {
    const { getDatabaseDriver } = await import("@/db/adapter");
    expect(getDatabaseDriver()).toBe("sqlite");
  });

  it("returns sqlite when DATABASE_DRIVER=sqlite", async () => {
    process.env.DATABASE_DRIVER = "sqlite";
    const { getDatabaseDriver } = await import("@/db/adapter");
    expect(getDatabaseDriver()).toBe("sqlite");
  });

  it("returns postgresql when DATABASE_DRIVER=postgresql", async () => {
    process.env.DATABASE_DRIVER = "postgresql";
    const { getDatabaseDriver } = await import("@/db/adapter");
    expect(getDatabaseDriver()).toBe("postgresql");
    delete process.env.DATABASE_DRIVER;
  });

  it("throws on invalid DATABASE_DRIVER value", async () => {
    process.env.DATABASE_DRIVER = "mysql";
    const { getDatabaseDriver } = await import("@/db/adapter");
    expect(() => getDatabaseDriver()).toThrow("Invalid DATABASE_DRIVER");
    delete process.env.DATABASE_DRIVER;
  });

  it("isPostgresql returns false by default", async () => {
    const { isPostgresql } = await import("@/db/adapter");
    expect(isPostgresql()).toBe(false);
  });

  it("isPostgresql returns true when DATABASE_DRIVER=postgresql", async () => {
    process.env.DATABASE_DRIVER = "postgresql";
    const { isPostgresql } = await import("@/db/adapter");
    expect(isPostgresql()).toBe(true);
    delete process.env.DATABASE_DRIVER;
  });
});
