import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeSnippet } from "@/lib/sanitize";

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

  describe("sanitizeSnippet", () => {
    it("preserves <mark> tags from FTS5 highlights", () => {
      expect(sanitizeSnippet("hello <mark>world</mark>")).toBe(
        "hello <mark>world</mark>"
      );
    });

    it("strips <script> tags via escaping", () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeSnippet(malicious);
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("strips <img onerror> XSS via escaping", () => {
      const malicious = '<img src=x onerror=alert(document.cookie)>';
      const result = sanitizeSnippet(malicious);
      expect(result).not.toContain("<img");
      expect(result).toContain("&lt;img");
    });

    it("preserves <mark> while stripping other tags", () => {
      const mixed = '<mark>search</mark> term <script>evil()</script>';
      const result = sanitizeSnippet(mixed);
      expect(result).toBe(
        '<mark>search</mark> term &lt;script&gt;evil()&lt;&#x2F;script&gt;'
      );
    });

    it("handles case-insensitive <mark> tags", () => {
      expect(sanitizeSnippet("<MARK>word</MARK>")).toBe("<mark>word</mark>");
    });

    it("returns escaped text when no mark tags present", () => {
      expect(sanitizeSnippet("plain text")).toBe("plain text");
    });

    it("handles multiple <mark> segments", () => {
      const input = "<mark>foo</mark> bar <mark>baz</mark>";
      expect(sanitizeSnippet(input)).toBe("<mark>foo</mark> bar <mark>baz</mark>");
    });
  });
});
