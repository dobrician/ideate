import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { statusBadgeClass, statusLabel, deadlineBadge } from "@/lib/status-utils";

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

  describe("deadlineBadge", () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "dashboard.deadlineOverdue": "Overdue",
        "dashboard.deadlineDaysLeft": `${vars?.count}d left`,
      };
      return map[key] ?? key;
    };

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2026-02-16T12:00:00Z").getTime(),
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns null for null deadline", () => {
      expect(deadlineBadge(null, t)).toBeNull();
    });

    it("returns overdue badge with red styling for past deadlines", () => {
      const past = new Date("2026-02-15T00:00:00Z");
      const badge = deadlineBadge(past, t)!;
      expect(badge.label).toBe("Overdue");
      expect(badge.className).toContain("bg-red-100");
      expect(badge.className).toContain("text-red-800");
      expect(badge.className).toContain("dark:bg-red-900/50");
    });

    it("returns amber badge for deadline within 7 days", () => {
      const soon = new Date("2026-02-20T12:00:00Z");
      const badge = deadlineBadge(soon, t)!;
      expect(badge.label).toBe("4d left");
      expect(badge.className).toContain("bg-amber-100");
      expect(badge.className).toContain("text-amber-800");
    });

    it("returns blue/neutral badge for deadline more than 7 days away", () => {
      const future = new Date("2026-03-10T12:00:00Z");
      const badge = deadlineBadge(future, t)!;
      expect(badge.className).toContain("bg-blue-100");
      expect(badge.className).toContain("text-blue-800");
    });

    it("returns amber badge for exactly 7 days", () => {
      const exact = new Date("2026-02-23T12:00:00Z");
      const badge = deadlineBadge(exact, t)!;
      expect(badge.label).toBe("7d left");
      expect(badge.className).toContain("amber");
    });

    it("returns correct day count near boundary", () => {
      // 8 days away → blue/neutral
      const eightDays = new Date("2026-02-24T13:00:00Z");
      const badge = deadlineBadge(eightDays, t)!;
      expect(badge.className).toContain("blue");
    });
  });
});
