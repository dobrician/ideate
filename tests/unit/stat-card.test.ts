import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "@/components/stat-card";

describe("StatCard utilities", () => {
  describe("formatRelativeTime", () => {
    it("should return 'just now' for less than 1 minute", () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe("just now");
    });

    it("should return minutes for less than 1 hour", () => {
      const date = new Date(Date.now() - 5 * 60000); // 5 minutes ago
      expect(formatRelativeTime(date)).toBe("5m ago");
    });

    it("should return hours for less than 1 day", () => {
      const date = new Date(Date.now() - 3 * 3600000); // 3 hours ago
      expect(formatRelativeTime(date)).toBe("3h ago");
    });

    it("should return days for more than 1 day", () => {
      const date = new Date(Date.now() - 2 * 86400000); // 2 days ago
      expect(formatRelativeTime(date)).toBe("2d ago");
    });

    it("should return '1m ago' for exactly 1 minute", () => {
      const date = new Date(Date.now() - 60000);
      expect(formatRelativeTime(date)).toBe("1m ago");
    });

    it("should return '1h ago' for exactly 1 hour", () => {
      const date = new Date(Date.now() - 3600000);
      expect(formatRelativeTime(date)).toBe("1h ago");
    });

    it("should return '1d ago' for exactly 1 day", () => {
      const date = new Date(Date.now() - 86400000);
      expect(formatRelativeTime(date)).toBe("1d ago");
    });
  });

  describe("formatRelativeTime with t() function", () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "time.justNow": "just now",
        "time.minutesAgo": `${vars?.count}m ago`,
        "time.hoursAgo": `${vars?.count}h ago`,
        "time.daysAgo": `${vars?.count}d ago`,
      };
      return map[key] ?? key;
    };

    it("should use t() for just now", () => {
      const date = new Date(Date.now() - 30000);
      expect(formatRelativeTime(date, t)).toBe("just now");
    });

    it("should use t() for minutes", () => {
      const date = new Date(Date.now() - 5 * 60000);
      expect(formatRelativeTime(date, t)).toBe("5m ago");
    });

    it("should use t() for hours", () => {
      const date = new Date(Date.now() - 3 * 3600000);
      expect(formatRelativeTime(date, t)).toBe("3h ago");
    });

    it("should use t() for days", () => {
      const date = new Date(Date.now() - 2 * 86400000);
      expect(formatRelativeTime(date, t)).toBe("2d ago");
    });
  });
});
