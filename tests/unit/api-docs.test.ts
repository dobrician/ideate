import { describe, it, expect } from "vitest";

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET as getSpec } from "@/app/api/docs/spec/route";
import { GET as getDocs } from "@/app/api/docs/route";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("API Documentation Routes", () => {
  describe("GET /api/docs/spec", () => {
    it("should return the OpenAPI spec as JSON", async () => {
      const response = await getSpec();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.openapi).toBe("3.0.3");
      expect(data.info.title).toBe("Ideate API");
    });

    it("should include all expected tags", async () => {
      const response = await getSpec();
      const data = await response.json();

      const tagNames = data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain("Health");
      expect(tagNames).toContain("Auth");
      expect(tagNames).toContain("Projects");
      expect(tagNames).toContain("Webhooks");
      expect(tagNames).toContain("AI");
    });

    it("should include paths for all major endpoints", async () => {
      const response = await getSpec();
      const data = await response.json();

      expect(data.paths["/api/health"]).toBeDefined();
      expect(data.paths["/api/me"]).toBeDefined();
      expect(data.paths["/api/search"]).toBeDefined();
      expect(data.paths["/api/auth/register"]).toBeDefined();
      expect(data.paths["/api/admin/webhooks"]).toBeDefined();
    });

    it("should include component schemas", async () => {
      const response = await getSpec();
      const data = await response.json();

      expect(data.components.schemas.User).toBeDefined();
      expect(data.components.schemas.Project).toBeDefined();
      expect(data.components.schemas.SearchResult).toBeDefined();
      expect(data.components.schemas.Webhook).toBeDefined();
    });

    it("should set cache headers", async () => {
      const response = await getSpec();
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });
  });

  describe("GET /api/docs", () => {
    it("should return HTML with Swagger UI", async () => {
      const response = await getDocs();
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(html).toContain("swagger-ui");
      expect(html).toContain("/api/docs/spec");
    });

    it("should include proper HTML structure", async () => {
      const response = await getDocs();
      const html = await response.text();

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
      expect(html).toContain("<title>");
    });

    it("should load swagger-ui-dist from CDN", async () => {
      const response = await getDocs();
      const html = await response.text();

      expect(html).toContain("swagger-ui-dist");
      expect(html).toContain("SwaggerUIBundle");
    });

    it("should set cache headers", async () => {
      const response = await getDocs();
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });
  });
});
