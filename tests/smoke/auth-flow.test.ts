import { test, expect } from "@playwright/test";
const APP_URL=process.env.APP_URL || "https://ideate.surcod.ro";

test.describe("Live SSO-only authentication", () => {
  test("should initiate configured SurCod SSO with PKCE and exact callback", async ({ request }) => {
    const response=await request.get(`${APP_URL}/api/auth/oidc?redirect=%2Fprojects`,{maxRedirects:0});
    expect(response.status()).toBe(307);
    const target=new URL(response.headers().location);
    expect(target.origin).toBe("https://sso.surcod.ro");
    expect(target.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/auth/oidc/callback`);
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("response_type")).toBe("code");
  });
  test("should render only SSO retry after provider failure", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login?error=oidc_error`);
    await expect(page.getByRole("link",{name:"Sign in with SSO",exact:true})).toBeVisible();
    await expect(page.locator("form, input")).toHaveCount(0);
  });
  test("should reject retired credential endpoints without sending mail", async ({ request }) => {
    for(const path of ["/api/auth/register","/api/auth/login-password","/api/auth/forgot-password","/api/auth/reset-password","/api/auth/resend-verification","/api/auth/verify-email","/auth/request"]) {
      expect((await request.post(`${APP_URL}${path}`,{data:{email:"blocked@example.invalid"},maxRedirects:0})).status(),path).toBe(404);
    }
  });
  test("should reject invalid OIDC callback without issuing a session", async ({ request }) => {
    const response=await request.get(`${APP_URL}/api/auth/oidc/callback?code=invalid&state=invalid`,{maxRedirects:0});
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("error=oidc_state_mismatch");
    expect(response.headers()["set-cookie"] ?? "").not.toContain("session=");
  });
});
