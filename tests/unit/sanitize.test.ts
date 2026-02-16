import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  stripHtml,
  sanitizeInput,
  sanitizeObject,
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

  describe("sanitizeObject", () => {
    it("should sanitize string values in an object", () => {
      const obj = {
        name: "<script>bad</script>John",
        age: 30,
      };
      const result = sanitizeObject(obj);
      expect(result.name).toBe("badJohn");
      expect(result.age).toBe(30);
    });
  });
});
