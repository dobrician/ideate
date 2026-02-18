import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendDigestEmails = vi.fn();

vi.mock("@/lib/digest", () => ({
  sendDigestEmails: () => mockSendDigestEmails(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/cron/digest/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/cron/digest", () => {
  it("returns sent count on success", async () => {
    mockSendDigestEmails.mockResolvedValue(5);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sent).toBe(5);
  });

  it("returns 0 when no emails sent", async () => {
    mockSendDigestEmails.mockResolvedValue(0);
    const res = await GET();
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it("returns 500 on error", async () => {
    mockSendDigestEmails.mockRejectedValue(new Error("SMTP down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to send digest");
  });
});
