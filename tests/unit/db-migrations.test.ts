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

const mockLogInfo = vi.fn();
const mockLogFatal = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { info: mockLogInfo, fatal: mockLogFatal, error: vi.fn() },
}));

// Prevent process.exit from actually killing the test runner
const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("db/index migration logic", () => {
  beforeEach(() => {
    vi.resetModules();
    mockExec.mockReset();
    mockPrepare.mockReset();
    mockPragma.mockReset();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockLogInfo.mockReset();
    mockLogFatal.mockReset();
    mockExit.mockClear();
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

  it("should skip duplicate column errors (idempotent)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) {
        return JSON.stringify({ entries: [{ idx: 0, tag: "0002_alter" }] });
      }
      return "ALTER TABLE users ADD COLUMN foo TEXT;";
    });
    const mockRun = vi.fn();
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      run: mockRun,
    });
    // First exec calls succeed, ALTER TABLE throws duplicate column
    let execCallCount = 0;
    mockExec.mockImplementation((sql: string) => {
      execCallCount++;
      if (sql.includes("ALTER TABLE")) {
        throw new Error("duplicate column name: foo");
      }
    });

    await import("@/db/index");

    // Migration was recorded despite the skipped statement
    expect(mockRun).toHaveBeenCalledWith("0002_alter.sql");
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ migration: "0002_alter.sql" }),
      "Skipped idempotent statement"
    );
  });

  it("should retry on SQLITE_BUSY errors", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ entries: [{ idx: 0, tag: "0000_init" }] })
    );
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue({ 1: 1 }),
      run: vi.fn(),
    });

    let callCount = 0;
    mockExec.mockImplementation(() => {
      callCount++;
      // Fail on first attempt's BEGIN IMMEDIATE, succeed on second
      if (callCount === 2) {
        throw new Error("SQLITE_BUSY: database is locked");
      }
    });

    await import("@/db/index");

    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
      "Migration locked, retrying..."
    );
  });

  it("should rollback on non-idempotent migration error", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) {
        return JSON.stringify({ entries: [{ idx: 0, tag: "0003_bad" }] });
      }
      return "DROP TABLE nonexistent;";
    });
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      run: vi.fn(),
    });
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("DROP TABLE")) {
        throw new Error("no such table: nonexistent");
      }
      if (sql === "ROLLBACK") return;
    });

    await expect(import("@/db/index")).rejects.toThrow("process.exit called");
    expect(mockExec).toHaveBeenCalledWith("ROLLBACK");
    expect(mockLogFatal).toHaveBeenCalled();
  });

  it("should sort journal entries by idx", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) {
        return JSON.stringify({
          entries: [
            { idx: 2, tag: "0002_second" },
            { idx: 0, tag: "0000_first" },
            { idx: 1, tag: "0001_middle" },
          ],
        });
      }
      return "SELECT 1;";
    });
    const mockRun = vi.fn();
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      run: mockRun,
    });

    await import("@/db/index");

    // Verify migrations applied in order
    const runCalls = mockRun.mock.calls.map((c: unknown[]) => c[0]);
    expect(runCalls).toEqual([
      "0000_first.sql",
      "0001_middle.sql",
      "0002_second.sql",
    ]);
  });

  it("should skip 'already exists' errors as idempotent", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("_journal.json")) {
        return JSON.stringify({ entries: [{ idx: 0, tag: "0004_create" }] });
      }
      return "CREATE TABLE foo (id TEXT);";
    });
    const mockRun = vi.fn();
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      run: mockRun,
    });
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("CREATE TABLE foo")) {
        throw new Error("table foo already exists");
      }
    });

    await import("@/db/index");

    expect(mockRun).toHaveBeenCalledWith("0004_create.sql");
  });

  it("should abort after max retries on persistent SQLITE_BUSY", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ entries: [{ idx: 0, tag: "0000_init" }] })
    );
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      run: vi.fn(),
    });
    // Always throw SQLITE_BUSY on BEGIN IMMEDIATE
    mockExec.mockImplementation((sql: string) => {
      if (sql === "BEGIN IMMEDIATE") {
        throw new Error("SQLITE_BUSY: database is locked");
      }
      if (sql === "ROLLBACK") return;
    });

    await expect(import("@/db/index")).rejects.toThrow("process.exit called");
    expect(mockLogFatal).toHaveBeenCalled();
  });
});
