import { describe, it, expect, vi } from "vitest";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";

describe("status-utils", () => {
  describe("statusBadgeClass", () => {
    it("should return emerald classes for active status", () => {
      const result = statusBadgeClass("active");
      expect(result).toContain("bg-emerald-100");
      expect(result).toContain("text-emerald-800");
    });

    it("should return amber classes for draft status", () => {
      const result = statusBadgeClass("draft");
      expect(result).toContain("bg-amber-100");
      expect(result).toContain("text-amber-800");
    });

    it("should return muted classes for archived status", () => {
      const result = statusBadgeClass("archived");
      expect(result).toContain("bg-muted");
      expect(result).toContain("text-muted-foreground");
    });

    it("should return muted classes for unknown status", () => {
      const result = statusBadgeClass("unknown");
      expect(result).toContain("bg-muted");
      expect(result).toContain("text-muted-foreground");
    });

    it("should return muted classes for empty string", () => {
      const result = statusBadgeClass("");
      expect(result).toContain("bg-muted");
    });

    it("should include border-transparent for all statuses", () => {
      for (const status of ["active", "draft", "archived", "other"]) {
        expect(statusBadgeClass(status)).toContain("border-transparent");
      }
    });

    it("should include dark mode variants for active", () => {
      const result = statusBadgeClass("active");
      expect(result).toContain("dark:bg-emerald-900/50");
      expect(result).toContain("dark:text-emerald-300");
    });

    it("should include dark mode variants for draft", () => {
      const result = statusBadgeClass("draft");
      expect(result).toContain("dark:bg-amber-900/50");
      expect(result).toContain("dark:text-amber-300");
    });
  });

  describe("statusLabel", () => {
    const mockT = vi.fn((key: string) => `translated:${key}`);

    it("should translate active status", () => {
      const result = statusLabel("active", mockT);
      expect(mockT).toHaveBeenCalledWith("projects.status.active");
      expect(result).toBe("translated:projects.status.active");
    });

    it("should translate draft status", () => {
      const result = statusLabel("draft", mockT);
      expect(mockT).toHaveBeenCalledWith("projects.status.draft");
      expect(result).toBe("translated:projects.status.draft");
    });

    it("should translate archived status", () => {
      const result = statusLabel("archived", mockT);
      expect(mockT).toHaveBeenCalledWith("projects.status.archived");
      expect(result).toBe("translated:projects.status.archived");
    });

    it("should return raw status string for unknown status", () => {
      const result = statusLabel("custom-status", mockT);
      expect(result).toBe("custom-status");
    });

    it("should return empty string for empty status", () => {
      const result = statusLabel("", mockT);
      expect(result).toBe("");
    });
  });
});
