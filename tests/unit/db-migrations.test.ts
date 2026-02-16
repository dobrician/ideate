import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the migration logic by mocking all dependencies
const mockExec = vi.fn();
const mockPrepare = vi.fn();
const mockPragma = vi.fn();

vi.mock("better-sqlite3", () => {
  const MockDb = vi.fn(function MockDb() {
    return { exec: mockExec, prepare: mockPrepare, pragma: mockPragma };
  });
  return { default: MockDb };
});

vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock("@/db/schema", () => ({}));

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), fatal: vi.fn(), error: vi.fn() },
}));

describe("db/index migration logic", () => {
  beforeEach(() => {
    vi.resetModules();
    mockExec.mockReset();
    mockPrepare.mockReset();
    mockPragma.mockReset();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("should skip migrations when journal file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    mockPrepare.mockReturnValue({ get: vi.fn(), run: vi.fn() });

    await import("@/db/index");

    // Only CREATE TABLE — returns early before BEGIN IMMEDIATE when no journal
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(mockExec.mock.calls[0][0]).toContain("_migrations");
  });

  it("should skip already-applied migrations", async () => {
    // Journal exists
    mockExistsSync.mockReturnValue(true);
    // Journal content
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ entries: [{ idx: 0, tag: "0000_init" }] })
    );
    // Migration already applied
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue({ 1: 1 }),
      run: vi.fn(),
    });

    await import("@/db/index");

    // CREATE TABLE + BEGIN IMMEDIATE + COMMIT (migration skipped)
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("should skip migration file that does not exist on disk", async () => {
    // Journal path exists, but the .sql file does not
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) return true;
      return false; // .sql file does not exist
    });
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ entries: [{ idx: 0, tag: "0000_missing" }] })
    );
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null), // not applied
      run: vi.fn(),
    });

    await import("@/db/index");

    // CREATE TABLE + BEGIN IMMEDIATE + COMMIT (no .sql file to apply)
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("should apply pending migration with statement breakpoints", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) {
        return JSON.stringify({ entries: [{ idx: 0, tag: "0001_create" }] });
      }
      return "CREATE TABLE foo (id TEXT);--> statement-breakpoint\nCREATE INDEX idx ON foo(id);";
    });
    const mockRun = vi.fn();
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null), // not applied
      run: mockRun,
    });

    await import("@/db/index");

    // CREATE TABLE + BEGIN IMMEDIATE + 2 migration statements + COMMIT
    expect(mockExec).toHaveBeenCalledTimes(5);
    expect(mockExec.mock.calls[1][0]).toBe("BEGIN IMMEDIATE");
    expect(mockExec.mock.calls[4][0]).toBe("COMMIT");
    expect(mockRun).toHaveBeenCalledWith("0001_create.sql");
  });
});
