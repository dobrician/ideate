import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockLeftJoin = vi.fn();
const mockGroupBy = vi.fn();
const mockInnerJoin = vi.fn();
const chain = { select: mockSelect, from: mockFrom, where: mockWhere,
  orderBy: mockOrderBy, limit: mockLimit, leftJoin: mockLeftJoin,
  groupBy: mockGroupBy, innerJoin: mockInnerJoin };
for (const fn of Object.values(chain)) fn.mockReturnValue(chain);
mockLimit.mockResolvedValue([]);

const mockSendMail = vi.fn().mockResolvedValue({});
const mockGetSmtpTransporter = vi.fn().mockReturnValue({ sendMail: mockSendMail });

vi.mock("@/db", () => ({ db: { select: () => chain } }));
vi.mock("@/db/schema", () => ({
  users: {}, projects: { id: "id", title: "title", createdAt: "created_at" },
  proposals: { id: "id", title: "title", projectId: "project_id", createdAt: "created_at" },
  votes: { value: "value", proposalId: "proposal_id", createdAt: "created_at" },
  comments: { createdAt: "created_at" },
  notificationPreferences: { userId: "user_id", emailWeeklyDigest: "email_weekly_digest" },
}));
vi.mock("@/lib/mail", () => ({ getSmtpTransporter: () => mockGetSmtpTransporter() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { generateDigestHtml, sendDigestEmails, gatherDigestData, getDigestSubscribers } from "@/lib/digest";
import type { DigestData } from "@/lib/digest";
import { logger } from "@/lib/logger";
const mLog = logger as unknown as Record<string, ReturnType<typeof vi.fn>>;

const digestData: DigestData = {
  newProjects: [{ id: "proj-1", title: "Test Project", createdAt: new Date("2026-02-15") }],
  topProposals: [{ id: "prop-1", title: "Great Idea", projectId: "proj-1", voteCount: 10 }],
  stats: { projectsCreated: 3, proposalsSubmitted: 7, votesCast: 42, commentsPosted: 15 },
};

function setupGatherMocks(
  p: unknown[] = [], pr: unknown[] = [],
  pc = [{ count: 0 }], prc = [{ count: 0 }], vc = [{ count: 0 }], cc = [{ count: 0 }]
) {
  let lc = 0, wc = 0;
  mockLimit.mockImplementation(() => {
    lc++;
    return Promise.resolve(lc === 1 ? p : lc === 2 ? pr : []);
  });
  mockWhere.mockImplementation(() => {
    wc++;
    if (wc <= 2) return chain;
    return Promise.resolve([pc, prc, vc, cc][wc - 3] ?? [{ count: 0 }]);
  });
}

function setupSubscribers(subs: unknown[]) {
  mockInnerJoin.mockReturnValue({ ...chain, where: vi.fn().mockResolvedValue(subs) });
}

const zeroCounts = () => setupGatherMocks([], [], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }]);

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(chain)) fn.mockReturnValue(chain);
  mockLimit.mockResolvedValue([]);
});

describe("Digest", () => {
  describe("generateDigestHtml", () => {
    it("generates valid HTML with doctype", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("includes project titles with links", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("Test Project");
      expect(html).toContain("/projects/proj-1");
    });

    it("includes proposal titles with vote counts", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("Great Idea");
      expect(html).toContain("10");
    });

    it("includes all activity stats", () => {
      const html = generateDigestHtml(digestData);
      for (const n of [3, 7, 42, 15]) expect(html).toContain(String(n));
    });

    it("handles empty data gracefully", () => {
      const empty: DigestData = {
        newProjects: [], topProposals: [],
        stats: { projectsCreated: 0, proposalsSubmitted: 0, votesCast: 0, commentsPosted: 0 },
      };
      const html = generateDigestHtml(empty);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).not.toContain("/projects/");
    });

    it("escapes HTML in project titles", () => {
      const xss: DigestData = { ...digestData,
        newProjects: [{ id: "p1", title: '<script>alert("xss")</script>', createdAt: new Date() }] };
      const html = generateDigestHtml(xss);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes HTML in proposal titles", () => {
      const xss: DigestData = { ...digestData,
        topProposals: [{ id: "p1", title: '<img onerror="alert(1)">', projectId: "proj-1", voteCount: 5 }] };
      expect(generateDigestHtml(xss)).not.toContain('onerror="alert(1)"');
    });

    it("includes footer and viewport meta", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("preferences");
      expect(html).toContain('name="viewport"');
    });

    it("uses APP_URL in project links", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("http://localhost:3000/projects/proj-1");
    });

    it("uses APP_URL in proposal links", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toContain("http://localhost:3000/projects/proj-1");
    });

    it("includes Ideate branding in footer", () => {
      const html = generateDigestHtml(digestData);
      expect(html).toMatch(/Ideate/);
    });
  });

  describe("gatherDigestData", () => {
    it("returns projects, proposals, and stats", async () => {
      setupGatherMocks(
        [{ id: "p1", title: "P1", createdAt: new Date() }],
        [{ id: "pr1", title: "Pr1", projectId: "p1", voteCount: "5" }],
        [{ count: 2 }], [{ count: 3 }], [{ count: 10 }], [{ count: 4 }]
      );
      const data = await gatherDigestData();
      expect(data.newProjects).toHaveLength(1);
      expect(data.topProposals[0].voteCount).toBe(5);
      expect(data.stats).toEqual({
        projectsCreated: 2, proposalsSubmitted: 3, votesCast: 10, commentsPosted: 4 });
    });

    it("returns empty on no recent activity", async () => {
      zeroCounts();
      const data = await gatherDigestData();
      expect(data.newProjects).toEqual([]);
      expect(data.topProposals).toEqual([]);
      expect(data.stats.projectsCreated).toBe(0);
    });

    it("converts voteCount string to number", async () => {
      setupGatherMocks([], [{ id: "pr1", title: "A", projectId: "p1", voteCount: "42" }],
        [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }]);
      const data = await gatherDigestData();
      expect(typeof data.topProposals[0].voteCount).toBe("number");
    });
  });

  describe("getDigestSubscribers", () => {
    it("returns subscribers who opted in", async () => {
      const subs = [{ id: "u1", email: "a@b.com", firstName: "Alice" }];
      setupSubscribers(subs);
      expect(await getDigestSubscribers()).toEqual(subs);
    });

    it("returns empty when no one opted in", async () => {
      setupSubscribers([]);
      expect(await getDigestSubscribers()).toEqual([]);
    });
  });

  describe("sendDigestEmails", () => {
    it("returns 0 when SMTP not configured", async () => {
      mockGetSmtpTransporter.mockReturnValue(null);
      expect(await sendDigestEmails()).toBe(0);
      expect(mLog.warn).toHaveBeenCalled();
    });

    it("returns 0 when no subscribers", async () => {
      mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
      setupSubscribers([]);
      expect(await sendDigestEmails()).toBe(0);
      expect(mLog.info).toHaveBeenCalled();
    });

    it("sends emails to all subscribers", async () => {
      mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
      setupSubscribers([
        { id: "u1", email: "a@b.com", firstName: "Alice" },
        { id: "u2", email: "b@c.com", firstName: "Bob" },
      ]);
      zeroCounts();
      expect(await sendDigestEmails()).toBe(2);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.com" }));
    });

    it("continues sending when one email fails", async () => {
      mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
      setupSubscribers([
        { id: "u1", email: "fail@b.com", firstName: "F" },
        { id: "u2", email: "ok@b.com", firstName: "O" },
      ]);
      zeroCounts();
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error")).mockResolvedValueOnce({});
      expect(await sendDigestEmails()).toBe(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ email: "fail@b.com" }), expect.any(String));
    });

    it("logs final sent count", async () => {
      mockGetSmtpTransporter.mockReturnValue({ sendMail: mockSendMail });
      setupSubscribers([{ id: "u1", email: "a@b.com", firstName: "A" }]);
      zeroCounts();
      await sendDigestEmails();
      expect(mLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ sent: 1, total: 1 }), expect.any(String));
    });
  });
});
