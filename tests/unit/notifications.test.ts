import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer
const mockSendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

// Mock db
const mockDbLimit = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbLimit(),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  proposals: { id: "id", title: "title", userId: "userId" },
  users: { id: "id", email: "email", firstName: "firstName" },
}));

// Mock mail module
const mockGetSmtpTransporter = vi.fn();
vi.mock("@/lib/mail", () => ({
  getSmtpTransporter: () => mockGetSmtpTransporter(),
}));

describe("Notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendMail.mockReset();
    mockDbLimit.mockReset();
    mockGetSmtpTransporter.mockReset();
    mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
  });

  describe("notifyVote", () => {
    it("should send email when conditions are met", async () => {
      // First call: fetch proposal
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        // Second call: fetch owner
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "John" }]);

      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-1", "proj-1", "voter-456", 1);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.to).toBe("owner@example.com");
      expect(mailCall.subject).toContain("upvoted");
    });

    it("should not send email when voter is the owner", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { title: "Test Proposal", userId: "same-user" },
      ]);

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-1", "proj-1", "same-user", 1);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should not send email when proposal has no owner", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { title: "Test Proposal", userId: null },
      ]);

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-1", "proj-1", "voter-456", 1);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should not send email when proposal not found", async () => {
      mockDbLimit.mockResolvedValueOnce([]);

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("nonexistent", "proj-1", "voter-456", 1);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should not send email when owner not found", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([]);

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-1", "proj-1", "voter-456", 1);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should use downvoted for negative votes", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "John" }]);

      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-2", "proj-1", "voter-456", -1);

      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.subject).toContain("downvoted");
    });

    it("should not throw on sendMail failure", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "John" }]);

      mockSendMail.mockRejectedValue(new Error("SMTP failure"));

      const { notifyVote } = await import("@/lib/notifications");
      // Should not throw
      await expect(
        notifyVote("prop-3", "proj-1", "voter-456", 1)
      ).resolves.toBeUndefined();
    });

    it("should debounce repeated notifications for same proposal", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "John" }]);
      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-deb", "proj-1", "voter-456", 1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      // Second call within debounce window — should be suppressed
      await notifyVote("prop-deb", "proj-1", "voter-789", -1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it("should skip when SMTP transporter is not configured", async () => {
      mockGetSmtpTransporter.mockReturnValue(null);

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-no-smtp", "proj-1", "voter-456", 1);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should use 'there' when owner firstName is null", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: null }]);
      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { notifyVote } = await import("@/lib/notifications");
      await notifyVote("prop-null-name", "proj-1", "voter-456", 1);

      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.html).toContain("Hi there");
    });
  });

  describe("notifyComment", () => {
    it("should send email for new comment", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "Jane" }]);

      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { notifyComment } = await import("@/lib/notifications");
      await notifyComment("prop-c1", "proj-1", "commenter-456", "Great idea!");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.to).toBe("owner@example.com");
      expect(mailCall.subject).toContain("New comment");
    });

    it("should truncate long comment content", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: null }]);

      mockSendMail.mockResolvedValue({ messageId: "test" });

      const longContent = "x".repeat(200);
      const { notifyComment } = await import("@/lib/notifications");
      await notifyComment("prop-c2", "proj-1", "commenter-456", longContent);

      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.text).toContain("...");
    });

    it("should not send when commenter is the owner", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { title: "Test Proposal", userId: "same-user" },
      ]);

      const { notifyComment } = await import("@/lib/notifications");
      await notifyComment("prop-c3", "proj-1", "same-user", "Self comment");

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should not throw on failure", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([{ email: "owner@example.com", firstName: "Jane" }]);

      mockSendMail.mockRejectedValue(new Error("Connection failed"));

      const { notifyComment } = await import("@/lib/notifications");
      await expect(
        notifyComment("prop-c4", "proj-1", "commenter-456", "Test")
      ).resolves.toBeUndefined();
    });

    it("should skip when SMTP transporter is not configured", async () => {
      mockGetSmtpTransporter.mockReturnValue(null);

      const { notifyComment } = await import("@/lib/notifications");
      await notifyComment("prop-c-nosmtp", "proj-1", "commenter-456", "Test");

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should skip when owner user not found in db", async () => {
      mockDbLimit
        .mockResolvedValueOnce([{ title: "Test Proposal", userId: "owner-123" }])
        .mockResolvedValueOnce([]);
      const { notifyComment } = await import("@/lib/notifications");
      await notifyComment("prop-c-no-owner", "proj-1", "commenter-456", "Test");

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
