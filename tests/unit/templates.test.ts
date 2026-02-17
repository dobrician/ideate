import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
const mockRequireOrigin = vi.fn();

const mockSelectResult: unknown[] = [];
const mockInsertResult: unknown[] = [];
const mockDeleteWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => mockSelectResult,
    }),
    insert: () => ({
      values: () => ({
        returning: () => mockInsertResult,
      }),
    }),
    delete: () => ({
      where: mockDeleteWhere,
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  projectTemplates: { id: "id" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/csrf", () => ({
  requireOrigin: (req: unknown) => mockRequireOrigin(req),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET, POST } from "@/app/api/admin/templates/route";
import { DELETE } from "@/app/api/admin/templates/[id]/route";

// ── Test helpers ───────────────────────────────────────────────────────────

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const adminUser = { id: "user-1", email: "admin@example.com", role: "admin" };
const memberUser = { id: "user-2", email: "member@example.com", role: "member" };

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(adminUser);
  mockRequireOrigin.mockReturnValue(null);
  mockSelectResult.length = 0;
  mockInsertResult.length = 0;
  mockDeleteWhere.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Templates API Routes", () => {
  describe("GET /api/admin/templates", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return empty list when no templates exist", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toEqual([]);
    });

    it("should return templates with parsed defaultTags", async () => {
      mockSelectResult.push({
        id: "tpl-1",
        name: "Sprint Planning",
        description: null,
        titlePrefix: "[Sprint]",
        deadlineOffset: 14,
        defaultTags: '["tag-1","tag-2"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].name).toBe("Sprint Planning");
      expect(data.templates[0].defaultTags).toEqual(["tag-1", "tag-2"]);
    });

    it("should allow non-admin users to list templates", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toEqual([]);
    });
  });

  describe("POST /api/admin/templates", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for non-admin users", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);
      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when name is missing", async () => {
      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Template name is required");
    });

    it("should return 400 when name is too long", async () => {
      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ name: "x".repeat(201) }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Template name too long");
    });

    it("should create template successfully", async () => {
      const newTemplate = {
        id: "tpl-new",
        name: "Sprint Planning",
        description: "Sprint planning template",
        titlePrefix: "[Sprint]",
        deadlineOffset: 14,
        defaultTags: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockInsertResult.push(newTemplate);

      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({
          name: "Sprint Planning",
          description: "Sprint planning template",
          titlePrefix: "[Sprint]",
          deadlineOffset: 14,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.template.name).toBe("Sprint Planning");
      expect(data.template.defaultTags).toEqual([]);
    });

    it("should reject when CSRF origin check fails", async () => {
      mockRequireOrigin.mockReturnValue(
        new Response(JSON.stringify({ error: "Invalid origin" }), { status: 403 })
      );
      const request = createRequest("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/admin/templates/[id]", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const request = createRequest("/api/admin/templates/tpl-1", {
        method: "DELETE",
        headers: { "Origin": "http://localhost:3000" },
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "tpl-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for non-admin users", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);
      const request = createRequest("/api/admin/templates/tpl-1", {
        method: "DELETE",
        headers: { "Origin": "http://localhost:3000" },
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "tpl-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should delete template successfully", async () => {
      const request = createRequest("/api/admin/templates/tpl-1", {
        method: "DELETE",
        headers: { "Origin": "http://localhost:3000" },
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "tpl-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
