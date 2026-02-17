import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockLeftJoin = vi.fn();
const mockGroupBy = vi.fn();
const mockInnerJoin = vi.fn();

const chainedQuery = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  leftJoin: mockLeftJoin,
  groupBy: mockGroupBy,
  innerJoin: mockInnerJoin,
};

// Each method returns the chain
for (const fn of Object.values(chainedQuery)) {
  fn.mockReturnValue(chainedQuery);
}

// Default: limit returns empty array (final result)
mockLimit.mockResolvedValue([]);

const mockSendMail = vi.fn().mockResolvedValue({});
const mockGetSmtpTransporter = vi.fn().mockReturnValue({
  sendMail: mockSendMail,
});

vi.mock("@/db", () => ({
  db: {
    select: () => chainedQuery,
  },
}));

vi.mock("@/db/schema", () => ({
  users: {},
  projects: { id: "id", title: "title", createdAt: "created_at" },
  proposals: { id: "id", title: "title", projectId: "project_id", createdAt: "created_at" },
  votes: { value: "value", proposalId: "proposal_id", createdAt: "created_at" },
  comments: { createdAt: "created_at" },
  notificationPreferences: { userId: "user_id", emailWeeklyDigest: "email_weekly_digest" },
}));

vi.mock("@/lib/mail", () => ({
  getSmtpTransporter: () => mockGetSmtpTransporter(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { generateDigestHtml, sendDigestEmails } from "@/lib/digest";
import type { DigestData } from "@/lib/digest";

// ── Tests ──────────────────────────────────────────────────────────────────

const mockDigestData: DigestData = {
  newProjects: [
    { id: "proj-1", title: "Test Project", createdAt: new Date("2026-02-15") },
  ],
  topProposals: [
    { id: "prop-1", title: "Great Idea", projectId: "proj-1", voteCount: 10 },
  ],
  stats: {
    projectsCreated: 3,
    proposalsSubmitted: 7,
    votesCast: 42,
    commentsPosted: 15,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset chain returns
  for (const fn of Object.values(chainedQuery)) {
    fn.mockReturnValue(chainedQuery);
  }
  mockLimit.mockResolvedValue([]);
});

describe("Digest", () => {
  describe("generateDigestHtml", () => {
    it("should generate valid HTML", () => {
      const html = generateDigestHtml(mockDigestData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("should include project titles", () => {
      const html = generateDigestHtml(mockDigestData);
      expect(html).toContain("Test Project");
    });

    it("should include proposal titles", () => {
      const html = generateDigestHtml(mockDigestData);
      expect(html).toContain("Great Idea");
    });

    it("should include activity stats", () => {
      const html = generateDigestHtml(mockDigestData);
      expect(html).toContain("3");
      expect(html).toContain("7");
      expect(html).toContain("42");
      expect(html).toContain("15");
    });

    it("should handle empty data", () => {
      const emptyData: DigestData = {
        newProjects: [],
        topProposals: [],
        stats: {
          projectsCreated: 0,
          proposalsSubmitted: 0,
          votesCast: 0,
          commentsPosted: 0,
        },
      };
      const html = generateDigestHtml(emptyData);
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("should escape HTML in titles", () => {
      const xssData: DigestData = {
        ...mockDigestData,
        newProjects: [
          { id: "proj-1", title: '<script>alert("xss")</script>', createdAt: new Date() },
        ],
      };
      const html = generateDigestHtml(xssData);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("sendDigestEmails", () => {
    it("should return 0 when SMTP is not configured", async () => {
      mockGetSmtpTransporter.mockReturnValue(null);
      const sent = await sendDigestEmails();
      expect(sent).toBe(0);
    });

    it("should return 0 when no subscribers", async () => {
      mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
      // innerJoin returns empty for subscribers
      mockInnerJoin.mockReturnValue({ ...chainedQuery, where: vi.fn().mockResolvedValue([]) });
      const sent = await sendDigestEmails();
      expect(sent).toBe(0);
    });
  });
});
