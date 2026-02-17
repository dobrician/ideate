import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  stripHtml,
  sanitizeInput,
} from "@/lib/sanitize";

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

  describe("stripHtml", () => {
    it("should strip HTML tags", () => {
      expect(stripHtml("<b>bold</b>")).toBe("bold");
    });

    it("should strip nested tags", () => {
      expect(stripHtml("<div><p>text</p></div>")).toBe("text");
    });

    it("should handle script tags", () => {
      expect(stripHtml('<script>alert("xss")</script>')).toBe(
        'alert("xss")'
      );
    });

    it("should leave plain text untouched", () => {
      expect(stripHtml("no tags here")).toBe("no tags here");
    });
  });

  describe("sanitizeInput", () => {
    it("should strip tags and trim", () => {
      expect(sanitizeInput("  <b>text</b>  ")).toBe("text");
    });

    it("should handle empty string", () => {
      expect(sanitizeInput("")).toBe("");
    });
  });

});
