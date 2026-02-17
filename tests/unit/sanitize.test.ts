import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/sanitize";

describe("Sanitize", () => {
  describe("escapeHtml", () => {
    it("should escape ampersands", () => {
      expect(escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("should escape angle brackets", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should escape quotes", () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("should leave safe strings untouched", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("should escape forward slashes", () => {
      expect(escapeHtml("a/b")).toBe("a&#x2F;b");
    });

    it("should escape all special characters in one string", () => {
      expect(escapeHtml(`&<>"'/`)).toBe("&amp;&lt;&gt;&quot;&#x27;&#x2F;");
    });
  });
});
