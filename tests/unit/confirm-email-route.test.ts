import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockSelectResult: { id: string }[] = [];
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockSelectResult),
        }),
      }),
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...w: unknown[]) => {
            mockUpdateWhere(...w);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

const mockLogAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET } from "@/app/api/profile/confirm-email/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const APP_URL = "http://localhost:3000";

function makeToken(payload: Record<string, unknown>, secret = TEST_SECRET) {
  return jwt.sign(payload, secret, { issuer: "ideate", audience: "ideate", expiresIn: "1h" });
}

function makeRequest(token?: string): Request {
  const url = token
    ? `${APP_URL}/api/profile/confirm-email?token=${token}`
    : `${APP_URL}/api/profile/confirm-email`;
  return new Request(url, { method: "GET" });
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", TEST_SECRET);
  vi.stubEnv("APP_URL", APP_URL);
  mockSelectResult = [];
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockReset();
  mockLogAudit.mockClear();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/profile/confirm-email", () => {
  it("should redirect to invalid when no token provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=invalid");
  });

  it("should redirect to invalid for bad token type", async () => {
    const token = makeToken({ userId: "u1", newEmail: "x@y.com", type: "wrong" });
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=invalid");
  });

  it("should redirect to invalid when userId is missing", async () => {
    const token = makeToken({ newEmail: "x@y.com", type: "email-change" });
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=invalid");
  });

  it("should redirect to taken when email is already in use", async () => {
    mockSelectResult = [{ id: "other-user" }];
    const token = makeToken({ userId: "u1", newEmail: "taken@x.com", type: "email-change" });
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=taken");
  });

  it("should update email and redirect to success", async () => {
    const token = makeToken({ userId: "u1", newEmail: "new@x.com", type: "email-change" });
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=success");
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({ email: "new@x.com" });
  });

  it("should log audit event on successful email change", async () => {
    const token = makeToken({ userId: "u1", newEmail: "new@x.com", type: "email-change" });
    await GET(makeRequest(token));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        action: "change_email",
        entity: "user",
      })
    );
  });

  it("should redirect to expired for expired token", async () => {
    const token = jwt.sign(
      { userId: "u1", newEmail: "x@y.com", type: "email-change" },
      TEST_SECRET,
      { issuer: "ideate", audience: "ideate", expiresIn: "0s" }
    );
    // Wait a tick so the token is actually expired
    await new Promise((r) => setTimeout(r, 1100));
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=expired");
  });

  it("should redirect to expired for wrong secret", async () => {
    const token = makeToken({ userId: "u1", newEmail: "x@y.com", type: "email-change" }, "wrong-secret-that-is-also-32-chars!!");
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("emailChange=expired");
  });
});
