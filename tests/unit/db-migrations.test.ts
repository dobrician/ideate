import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExec = vi.fn();
const mockPrepare = vi.fn();
const mockPragma = vi.fn();
vi.mock("better-sqlite3", () => {
  const MockDb = vi.fn(function MockDb() {
    return { exec: mockExec, prepare: mockPrepare, pragma: mockPragma };
  });
  return { default: MockDb };
});
vi.mock("drizzle-orm/better-sqlite3", () => ({ drizzle: vi.fn(() => ({})) }));
vi.mock("@/db/schema", () => ({}));

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockMkdirSync = vi.fn();
vi.mock("fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

const mockLogInfo = vi.fn(), mockLogFatal = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: { info: mockLogInfo, fatal: mockLogFatal, error: vi.fn() },
}));

const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

const journal = (entries: { idx: number; tag: string }[]) =>
  JSON.stringify({ entries });
const prep = (applied: boolean) => ({
  get: vi.fn().mockReturnValue(applied ? { 1: 1 } : null),
  run: vi.fn(),
});

describe("db/index migration logic", () => {
  beforeEach(() => {
    vi.resetModules();
    [mockExec, mockPrepare, mockPragma, mockExistsSync, mockReadFileSync,
      mockMkdirSync, mockLogInfo, mockLogFatal].forEach(m => m.mockReset());
    mockExit.mockClear();
  });

  it("should skip migrations when journal file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    mockPrepare.mockReturnValue(prep(false));
    await import("@/db/index");
    // 1 = CREATE _migrations, +3 = FTS rebuild attempts
    expect(mockExec).toHaveBeenCalledTimes(4);
    expect(mockExec.mock.calls[0][0]).toContain("_migrations");
  });

  it("should skip already-applied migrations", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(journal([{ idx: 0, tag: "0000_init" }]));
    mockPrepare.mockReturnValue(prep(true));
    await import("@/db/index");
    // 3 = CREATE _migrations + BEGIN + COMMIT, +3 = FTS rebuild
    expect(mockExec).toHaveBeenCalledTimes(6);
  });

  it("should skip migration file that does not exist on disk", async () => {
    mockExistsSync.mockImplementation((path: string) =>
      path.includes("_journal.json"));
    mockReadFileSync.mockReturnValue(journal([{ idx: 0, tag: "0000_missing" }]));
    mockPrepare.mockReturnValue(prep(false));
    await import("@/db/index");
    // 3 = CREATE _migrations + BEGIN + COMMIT, +3 = FTS rebuild
    expect(mockExec).toHaveBeenCalledTimes(6);
  });

  it("should apply pending migration with statement breakpoints", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 0, tag: "0001_create" }])
        : "CREATE TABLE foo (id TEXT);--> statement-breakpoint\nCREATE INDEX idx ON foo(id);");
    const p = prep(false);
    mockPrepare.mockReturnValue(p);
    await import("@/db/index");
    // 5 = CREATE _migrations + BEGIN + 2 stmts + COMMIT, +3 = FTS rebuild
    expect(mockExec).toHaveBeenCalledTimes(8);
    expect(mockExec.mock.calls[1][0]).toBe("BEGIN IMMEDIATE");
    expect(mockExec.mock.calls[4][0]).toBe("COMMIT");
    expect(p.run).toHaveBeenCalledWith("0001_create.sql");
  });

  it("should skip duplicate column errors (idempotent)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 0, tag: "0002_alter" }])
        : "ALTER TABLE users ADD COLUMN foo TEXT;");
    const p = prep(false);
    mockPrepare.mockReturnValue(p);
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("ALTER TABLE")) throw new Error("duplicate column name: foo");
    });
    await import("@/db/index");
    expect(p.run).toHaveBeenCalledWith("0002_alter.sql");
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ migration: "0002_alter.sql" }),
      "Skipped idempotent statement");
  });

  it("should retry on SQLITE_BUSY errors", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(journal([{ idx: 0, tag: "0000_init" }]));
    mockPrepare.mockReturnValue(prep(true));
    let callCount = 0;
    mockExec.mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error("SQLITE_BUSY: database is locked");
    });
    await import("@/db/index");
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }), "Migration locked, retrying...");
  });

  it("should rollback on non-idempotent migration error", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 0, tag: "0003_bad" }])
        : "DROP TABLE nonexistent;");
    mockPrepare.mockReturnValue(prep(false));
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("DROP TABLE")) throw new Error("no such table: nonexistent");
      if (sql === "ROLLBACK") return;
    });
    await expect(import("@/db/index")).rejects.toThrow("process.exit called");
    expect(mockExec).toHaveBeenCalledWith("ROLLBACK");
    expect(mockLogFatal).toHaveBeenCalled();
  });

  it("should sort journal entries by idx", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 2, tag: "0002_second" }, { idx: 0, tag: "0000_first" }, { idx: 1, tag: "0001_middle" }])
        : "SELECT 1;");
    const p = prep(false);
    mockPrepare.mockReturnValue(p);
    await import("@/db/index");
    const runCalls = p.run.mock.calls.map((c: unknown[]) => c[0]);
    expect(runCalls).toEqual(["0000_first.sql", "0001_middle.sql", "0002_second.sql"]);
  });

  it("should skip 'already exists' errors as idempotent", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 0, tag: "0004_create" }])
        : "CREATE TABLE foo (id TEXT);");
    const p = prep(false);
    mockPrepare.mockReturnValue(p);
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("CREATE TABLE foo")) throw new Error("table foo already exists");
    });
    await import("@/db/index");
    expect(p.run).toHaveBeenCalledWith("0004_create.sql");
  });

  it("should use resolve('data/ideate.db') when DATABASE_URL is unset", async () => {
    const orig = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    mockExistsSync.mockReturnValue(false);
    mockPrepare.mockReturnValue(prep(false));
    const Database = (await import("better-sqlite3")).default;
    const callsBefore = vi.mocked(Database).mock.calls.length;
    await import("@/db/index");
    const lastCallArg = vi.mocked(Database).mock.calls[callsBefore][0];
    expect(String(lastCallArg)).toContain("data/ideate.db");
    process.env.DATABASE_URL = orig;
  });

  it("should handle non-Error thrown value in isIdempotentError", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes("_journal.json")
        ? journal([{ idx: 0, tag: "0005_str" }])
        : "CREATE TABLE bar (id TEXT);");
    const p = prep(false);
    mockPrepare.mockReturnValue(p);
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("CREATE TABLE bar")) {
        // eslint-disable-next-line no-throw-literal
        throw "table bar already exists";
      }
    });
    await import("@/db/index");
    expect(p.run).toHaveBeenCalledWith("0005_str.sql");
  });

  it("should abort after max retries on persistent SQLITE_BUSY", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(journal([{ idx: 0, tag: "0000_init" }]));
    mockPrepare.mockReturnValue(prep(false));
    mockExec.mockImplementation((sql: string) => {
      if (sql === "BEGIN IMMEDIATE") throw new Error("SQLITE_BUSY: database is locked");
      if (sql === "ROLLBACK") return;
    });
    await expect(import("@/db/index")).rejects.toThrow("process.exit called");
    expect(mockLogFatal).toHaveBeenCalled();
  });
});
