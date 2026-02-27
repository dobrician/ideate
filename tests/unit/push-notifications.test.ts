import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) }));
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => []),
  })),
}));
const mockDelete = vi.fn(() => ({ where: vi.fn(() => ({})) }));

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  pushSubscriptions: { userId: "user_id", endpoint: "endpoint", p256dhKey: "p256dh_key", authKey: "auth_key" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  buildPushPayload,
  getVapidPublicKey,
  isPushConfigured,
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
} from "@/lib/push";

describe("Push Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildPushPayload", () => {
    it("should build a proposal notification payload", () => {
      const payload = buildPushPayload("proposal", "New Proposal", "Check this out", "/projects/1");
      expect(payload.title).toBe("New Proposal");
      expect(payload.body).toBe("Check this out");
      expect(payload.url).toBe("/projects/1");
      expect(payload.tag).toBe("ideate-proposal");
    });

    it("should build a vote notification payload", () => {
      const payload = buildPushPayload("vote", "New Vote", "Someone voted");
      expect(payload.tag).toBe("ideate-vote");
    });

    it("should build a comment notification payload", () => {
      const payload = buildPushPayload("comment", "New Comment", "Someone commented");
      expect(payload.tag).toBe("ideate-comment");
    });

    it("should build a project notification payload", () => {
      const payload = buildPushPayload("project", "Project Update", "Status changed");
      expect(payload.tag).toBe("ideate-project");
    });

    it("should default url to / when not provided", () => {
      const payload = buildPushPayload("vote", "Test", "Test");
      expect(payload.url).toBe("/");
    });
  });

  describe("getVapidPublicKey", () => {
    it("should return null when not configured", () => {
      delete process.env.VAPID_PUBLIC_KEY;
      expect(getVapidPublicKey()).toBeNull();
    });

    it("should return the key when configured", () => {
      process.env.VAPID_PUBLIC_KEY = "test-key-123";
      expect(getVapidPublicKey()).toBe("test-key-123");
      delete process.env.VAPID_PUBLIC_KEY;
    });
  });

  describe("isPushConfigured", () => {
    it("should return false when keys are missing", () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      expect(isPushConfigured()).toBe(false);
    });

    it("should return false when only public key is set", () => {
      process.env.VAPID_PUBLIC_KEY = "pub";
      delete process.env.VAPID_PRIVATE_KEY;
      expect(isPushConfigured()).toBe(false);
      delete process.env.VAPID_PUBLIC_KEY;
    });

    it("should return true when both keys are set", () => {
      process.env.VAPID_PUBLIC_KEY = "pub";
      process.env.VAPID_PRIVATE_KEY = "priv";
      expect(isPushConfigured()).toBe(true);
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    });
  });

  describe("saveSubscription", () => {
    it("should delete existing and insert new subscription", async () => {
      await saveSubscription("user-1", {
        endpoint: "https://push.example.com/sub1",
        keys: { p256dh: "key1", auth: "auth1" },
      });
      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("removeSubscription", () => {
    it("should delete the subscription", async () => {
      await removeSubscription("user-1", "https://push.example.com/sub1");
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("getUserSubscriptions", () => {
    it("should query subscriptions for user", async () => {
      await getUserSubscriptions("user-1");
      expect(mockSelect).toHaveBeenCalled();
    });
  });
});
