import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(() => ({ audit:vi.fn(), clear:vi.fn(), session:vi.fn() }));
vi.mock("@/lib/auth", () => ({ clearSession:mocks.clear, getSession:mocks.session }));
vi.mock("@/lib/audit", () => ({ logAudit:mocks.audit }));
vi.mock("@/lib/csrf", () => ({ requireOrigin:() => null }));
import { POST } from "@/app/auth/logout/route";
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({userId:"sso-user"}); });
describe("SSO application logout audit", () => {
  it("should clear the application session and audit its owner", async () => {
    const response=await POST(new NextRequest("http://localhost:3000/auth/logout",{method:"POST",headers:{accept:"application/json"}}));
    expect(response.status).toBe(200);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({userId:"sso-user",action:"logout"}));
  });
  it("should return to public home rather than immediately signing in again", async () => {
    const response=await POST(new NextRequest("http://localhost:3000/auth/logout",{method:"POST"}));
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
