import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

// We need to mock the DB at a level that prevents the real DB import
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn().mockResolvedValue(Buffer.from("test")),
  unlink: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe("attachments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("POST /api/attachments", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { POST } = await import("@/app/api/attachments/route");

      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");
      formData.append("proposalId", "test-id");

      const req = new NextRequest("http://localhost:3000/api/attachments", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects viewers (no proposal:create permission)", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-1",
        role: "viewer",
      });

      const { POST } = await import("@/app/api/attachments/route");

      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");
      formData.append("proposalId", "test-id");

      const req = new NextRequest("http://localhost:3000/api/attachments", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("requires file and proposalId", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-1",
        role: "member",
      });

      const { POST } = await import("@/app/api/attachments/route");

      const formData = new FormData();
      // Missing both file and proposalId

      const req = new NextRequest("http://localhost:3000/api/attachments", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("required");
    });

    it("rejects files over 5MB", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-1",
        role: "member",
      });

      // Mock proposal exists
      const { db } = await import("@/db");
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [{ id: "p-1" }],
          }),
        }),
      } as never);

      const { POST } = await import("@/app/api/attachments/route");

      const largeContent = new Uint8Array(6 * 1024 * 1024);
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([largeContent], { type: "application/octet-stream" }),
        "large.bin"
      );
      formData.append("proposalId", "test-proposal");

      const req = new NextRequest("http://localhost:3000/api/attachments", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("5MB");
    });
  });

  describe("GET /api/attachments/[id]", () => {
    it("rejects unauthenticated download requests", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { GET } = await import("@/app/api/attachments/[id]/route");

      const req = new NextRequest(
        "http://localhost:3000/api/attachments/att-1"
      );

      const res = await GET(req, {
        params: Promise.resolve({ id: "att-1" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/attachments/[id]", () => {
    it("rejects unauthenticated delete requests", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { DELETE } = await import("@/app/api/attachments/[id]/route");

      const req = new NextRequest(
        "http://localhost:3000/api/attachments/att-1",
        { method: "DELETE" }
      );

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "att-1" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("schema", () => {
    it("attachments table is exported from schema", async () => {
      vi.doUnmock("@/db/schema");
      // Use a dynamic import with a fresh module
      const schema = await vi.importActual<typeof import("@/db/schema")>("@/db/schema");
      expect(schema.attachments).toBeDefined();
    });
  });
});
