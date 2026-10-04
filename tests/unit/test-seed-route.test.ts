import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ config: vi.fn(), values: vi.fn(async () => undefined), token: vi.fn(() => "isolated-session") }));
vi.mock("@/lib/e2e-config", () => ({ getE2EConfig: mocks.config }));
vi.mock("@/db", () => ({ db: { insert: vi.fn(() => ({ values: mocks.values })) } }));
vi.mock("@/lib/auth", () => ({ createSessionToken: mocks.token }));
vi.mock("@/lib/rate-limit", () => ({ resetRateLimits: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { POST } from "@/app/api/test/seed/route";
const request = (data: unknown) => new NextRequest("https://localhost:4111/api/test/seed", { method: "POST", body: JSON.stringify(data), headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ secret: "fixture", origin: new URL("https://localhost:4111") });
});
describe("TestSeedRoute", () => {
  it("should return 404 and leave data untouched when fixtures are disabled", async () => {
    mocks.config.mockReturnValue(null);
    expect((await POST(request({ secret: "fixture" }))).status).toBe(404);
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it.each([{ secret: "wrong" }, { secret: "fixture", role: "superuser" }, {}])("should reject invalid fixture authorization %j", async data => {
    expect((await POST(request(data))).status).toBe(403);
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it("should return isolated cookies and retain the requested application role", async () => {
    const response = await POST(request({ secret: "fixture", role: "member" }));
    expect(response.status).toBe(200);
    const fixture = await response.json();
    expect(fixture.password).toBeUndefined();
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ role: "member" }));
    expect(fixture.cookies).toEqual(expect.arrayContaining([expect.objectContaining({ name: "session", httpOnly: true, secure: true, domain: "localhost", sameSite: "Lax" })]));
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("should report a structured error when fixture creation fails", async () => {
    mocks.values.mockRejectedValueOnce(new Error("DB unavailable"));
    expect((await POST(request({ secret: "fixture" }))).status).toBe(500);
  });
});
