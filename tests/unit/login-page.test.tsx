import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ redirect: vi.fn((destination: string) => { throw new Error(destination); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/i18n-server", () => ({ getTranslations: async () => ({ t: (key: string) => key }) }));
import LoginPage from "@/app/auth/login/page";
beforeEach(() => vi.clearAllMocks());
describe("LoginPage", () => {
  it("should enter SSO directly and preserve a safe project destination", async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({ redirect: "/p/demo?view=votes" }) })).rejects.toThrow("/api/auth/oidc?redirect=%2Fp%2Fdemo%3Fview%3Dvotes");
  });
  it("should replace external return destinations with the public home", async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({ redirect: "https://evil.invalid" }) })).rejects.toThrow("/api/auth/oidc?redirect=%2F");
  });
  it("should render a retry on errors without reflecting provider messages", async () => {
    const result = await LoginPage({ searchParams: Promise.resolve({ error: "secret-provider-message", redirect: "/projects" }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("auth.oidcError");
    expect(serialized).toContain("/api/auth/oidc?redirect=%2Fprojects");
    expect(serialized).not.toContain("secret-provider-message");
    expect(serialized).not.toContain('"type":"input"');
  });
});
