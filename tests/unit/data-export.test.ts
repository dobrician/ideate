import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
const mockDbFrom = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("@/db/schema", () => ({
  projects: { id: "id", userId: "user_id", createdAt: "created_at" },
  proposals: { id: "id", projectId: "project_id", userId: "user_id", createdAt: "created_at" },
  votes: { proposalId: "proposal_id", userId: "user_id", value: "value" },
  comments: { proposalId: "proposal_id", projectId: "project_id", userId: "user_id" },
  users: { id: "id", email: "email", firstName: "first_name", lastName: "last_name", role: "role", createdAt: "created_at" },
  notificationPreferences: { userId: "user_id" },
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: (...args: unknown[]) => mockDbFrom(...args),
    }),
  },
}));

vi.mock("@/lib/export", () => ({
  generateCsv: vi.fn().mockReturnValue("Type,Title\nProject,Test"),
  generatePdf: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
}));

vi.mock("@/lib/csrf", () => ({
  requireOrigin: vi.fn().mockReturnValue(null),
}));

// Mock archiver to produce a real ZIP-like buffer without actual compression
vi.mock("archiver", () => ({
  default: () => {
    let passthroughRef: { push: (chunk: unknown) => void; end: () => void } | null = null;
    return {
      pipe: (pt: { push: (chunk: unknown) => void; end: () => void }) => {
        passthroughRef = pt;
      },
      append: vi.fn(),
      finalize: () => {
        if (passthroughRef) {
          passthroughRef.push(Buffer.from("PK-mock-zip"));
          passthroughRef.push(null); // end stream
        }
        return Promise.resolve();
      },
    };
  },
}));

// Mock PassThrough as a simple async iterable buffer collector
vi.mock("stream", () => ({
  PassThrough: class MockPassThrough {
    private chunks: Buffer[] = [];
    private done = false;
    private resolve: (() => void) | null = null;

    pipe() { return this; }

    push(chunk: Buffer | null) {
      if (chunk === null) {
        this.done = true;
        if (this.resolve) this.resolve();
      } else {
        this.chunks.push(chunk);
        if (this.resolve) this.resolve();
      }
    }

    end() {
      this.done = true;
      if (this.resolve) this.resolve();
    }

    async *[Symbol.asyncIterator]() {
      while (!this.done || this.chunks.length > 0) {
        if (this.chunks.length > 0) {
          yield this.chunks.shift()!;
        } else {
          await new Promise<void>((r) => { this.resolve = r; });
        }
      }
    }
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET as adminExportGET } from "@/app/api/admin/export/route";
import { GET as userExportGET } from "@/app/api/me/export/route";

// ── Test helpers ───────────────────────────────────────────────────────────

const adminUser = { id: "user-1", email: "admin@example.com", role: "admin" };
const memberUser = { id: "user-2", email: "member@example.com", role: "member" };

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(adminUser);

  // Default mock: handles both direct Promise.all and chained .where() patterns
  mockDbFrom.mockImplementation(() => {
    const result: unknown[] = [];
    return {
      where: () => result,
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Platform Export", () => {
  describe("GET /api/admin/export", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await adminExportGET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for non-admin users", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);

      const response = await adminExportGET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return ZIP response for admin users", async () => {
      const response = await adminExportGET();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toContain(
        "ideate-platform-export-"
      );
    });
  });
});

describe("User GDPR Data Export", () => {
  describe("GET /api/me/export", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await userExportGET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return ZIP response for authenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);

      const response = await userExportGET();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toContain(
        "my-data-export-"
      );
    });

    it("should allow any authenticated user (GDPR right)", async () => {
      // Even viewer role should be able to export their own data
      mockGetCurrentUser.mockResolvedValue({ id: "u-3", email: "viewer@test.com", role: "viewer" });

      const response = await userExportGET();

      expect(response.status).toBe(200);
    });
  });
});

describe("Project Export Date Range Filter", () => {
  it("should reject invalid from date format", async () => {
    const { GET } = await import("@/app/api/projects/[id]/export/route");

    const request = new NextRequest(
      new URL(
        "/api/projects/proj-1/export?format=csv&from=not-a-date",
        "http://localhost:3000"
      )
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "proj-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid 'from' date");
  });

  it("should reject invalid to date format", async () => {
    const { GET } = await import("@/app/api/projects/[id]/export/route");

    const request = new NextRequest(
      new URL(
        "/api/projects/proj-1/export?format=csv&to=invalid",
        "http://localhost:3000"
      )
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "proj-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid 'to' date");
  });

  it("should accept valid date range and proceed to project lookup", async () => {
    const { GET } = await import("@/app/api/projects/[id]/export/route");

    // Mock returns empty for project lookup = 404
    mockDbFrom.mockImplementation(() => ({
      where: () => ({ limit: () => [] }),
      then: (resolve: (v: unknown) => void) => resolve([]),
    }));

    const request = new NextRequest(
      new URL(
        "/api/projects/proj-1/export?format=csv&from=2026-01-01&to=2026-02-01",
        "http://localhost:3000"
      )
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "proj-1" }),
    });

    // Date params parsed OK (no 400 error), project not found
    expect(response.status).toBe(404);
  });

  it("should work without date range parameters", async () => {
    const { GET } = await import("@/app/api/projects/[id]/export/route");

    mockDbFrom.mockImplementation(() => ({
      where: () => ({ limit: () => [] }),
      then: (resolve: (v: unknown) => void) => resolve([]),
    }));

    const request = new NextRequest(
      new URL("/api/projects/proj-1/export?format=csv", "http://localhost:3000")
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "proj-1" }),
    });

    // No date filter errors, just 404 for missing project
    expect(response.status).toBe(404);
  });
});
