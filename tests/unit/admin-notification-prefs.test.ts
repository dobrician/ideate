import { describe, it, expect, vi, beforeEach } from "vitest";

let queryResults: unknown[][] = [];
let queryIndex = 0;
let insertedValues: unknown[] = [];
let updatedValues: unknown[] = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const result = queryResults[queryIndex++] ?? [];
          return {
            limit: () => Promise.resolve(result),
            then: (resolve: (v: unknown[]) => void) => resolve(result),
          };
        },
      }),
    }),
    insert: () => ({
      values: (vals: unknown) => {
        insertedValues.push(vals);
        return Promise.resolve({});
      },
    }),
    update: () => ({
      set: (vals: unknown) => {
        updatedValues.push(vals);
        return {
          where: () => Promise.resolve({}),
        };
      },
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  notificationChannelPrefs: {
    id: "id",
    userId: "userId",
    category: "category",
    channel: "channel",
    enabled: "enabled",
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import {
  getAdminAlertPreferences,
  updateAdminAlertPreference,
  shouldDeliverAdminAlert,
} from "@/lib/admin-notification-prefs";

describe("admin-notification-prefs", () => {
  beforeEach(() => {
    queryResults = [];
    queryIndex = 0;
    insertedValues = [];
    updatedValues = [];
  });

  describe("getAdminAlertPreferences", () => {
    it("returns all-enabled defaults when no stored preferences", async () => {
      queryResults = [[]]; // empty DB result

      const prefs = await getAdminAlertPreferences("user-1");

      // 4 categories x 2 channels = 8 preferences
      expect(prefs).toHaveLength(8);
      expect(prefs.every((p) => p.enabled)).toBe(true);

      // Check all categories present
      const categories = [...new Set(prefs.map((p) => p.category))];
      expect(categories).toContain("ci_alerts");
      expect(categories).toContain("search_quality");
      expect(categories).toContain("embedding_alerts");
      expect(categories).toContain("system_events");

      // Check all channels present
      const channels = [...new Set(prefs.map((p) => p.channel))];
      expect(channels).toContain("in_app");
      expect(channels).toContain("email");
    });

    it("merges stored preferences with defaults", async () => {
      queryResults = [
        [
          { category: "ci_alerts", channel: "email", enabled: false },
          { category: "system_events", channel: "in_app", enabled: false },
        ],
      ];

      const prefs = await getAdminAlertPreferences("user-1");

      expect(prefs).toHaveLength(8);

      // Check disabled ones
      const ciEmail = prefs.find((p) => p.category === "ci_alerts" && p.channel === "email");
      expect(ciEmail?.enabled).toBe(false);

      const sysInApp = prefs.find((p) => p.category === "system_events" && p.channel === "in_app");
      expect(sysInApp?.enabled).toBe(false);

      // Check others are still enabled (defaults)
      const ciInApp = prefs.find((p) => p.category === "ci_alerts" && p.channel === "in_app");
      expect(ciInApp?.enabled).toBe(true);
    });

    it("returns defaults on DB error", async () => {
      queryResults = []; // will throw when accessing undefined index
      queryIndex = 100; // force out of bounds

      const prefs = await getAdminAlertPreferences("user-1");

      // Should still return 8 preferences, all enabled
      expect(prefs).toHaveLength(8);
      expect(prefs.every((p) => p.enabled)).toBe(true);
    });
  });

  describe("updateAdminAlertPreference", () => {
    it("creates new preference when none exists", async () => {
      queryResults = [[]]; // no existing

      await updateAdminAlertPreference("user-1", "ci_alerts", "email", false);

      expect(insertedValues).toHaveLength(1);
      expect(insertedValues[0]).toMatchObject({
        userId: "user-1",
        category: "ci_alerts",
        channel: "email",
        enabled: false,
      });
    });

    it("updates existing preference", async () => {
      queryResults = [[{ id: "pref-1" }]]; // existing

      await updateAdminAlertPreference("user-1", "ci_alerts", "email", true);

      expect(updatedValues).toHaveLength(1);
      expect(updatedValues[0]).toMatchObject({ enabled: true });
    });
  });

  describe("shouldDeliverAdminAlert", () => {
    it("returns true when no preference exists (default)", async () => {
      queryResults = [[]];

      const should = await shouldDeliverAdminAlert("user-1", "ci_alerts", "email");
      expect(should).toBe(true);
    });

    it("returns false when preference is disabled", async () => {
      queryResults = [[{ enabled: false }]];

      const should = await shouldDeliverAdminAlert("user-1", "ci_alerts", "email");
      expect(should).toBe(false);
    });

    it("returns true when preference is enabled", async () => {
      queryResults = [[{ enabled: true }]];

      const should = await shouldDeliverAdminAlert("user-1", "ci_alerts", "in_app");
      expect(should).toBe(true);
    });
  });
});
