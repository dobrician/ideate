import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("SSO-only authentication", () => {
  test("should send sign-in directly to SSO with the original destination", async ({ page }) => {
    await page.route("**/api/auth/oidc?**", route => route.fulfill({ status: 200, contentType: "text/html", body: "SSO entry captured" }));
    await page.goto("/auth/login?redirect=%2Fprojects%3Fstatus%3Darchived");
    await expect(page).toHaveURL(/\/api\/auth\/oidc\?redirect=%2Fprojects%3Fstatus%3Darchived/);
    await expect(page.getByText("SSO entry captured")).toBeVisible();
  });
  test("should offer only an SSO retry after failure", async ({ page }) => {
    await page.goto("/auth/login?error=oidc_error&redirect=%2Fp%2Fdemo");
    await expect(page.locator("[data-sso-retry]").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with SSO", exact: true })).toHaveAttribute("href", "/api/auth/oidc?redirect=%2Fp%2Fdemo");
    await expect(page.locator("input, form")).toHaveCount(0);
  });
  test("should reject all retired local authentication endpoints", async ({ request }) => {
    for (const path of ["/api/auth/login-password", "/api/auth/register", "/api/auth/reset-password", "/api/auth/forgot-password", "/api/auth/verify-email", "/api/auth/resend-verification", "/auth/request", "/auth/verify", "/api/profile/confirm-email"]) {
      const response = await request.post(path, { data: { email: "blocked@example.invalid", password: "unused", token: "unused" }, maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expect(response.headers()["set-cookie"] ?? "").not.toContain("session=");
    }
  });
  test("should not expose local registration or recovery pages", async ({ request }) => {
    for (const path of ["/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/auth/verify?token=old"]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
  });
  test("should reject a pre-migration local session", async ({ page, baseURL }) => {
    const { default: jwt } = await import("jsonwebtoken");
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Isolated E2E JWT_SECRET required");
    const token=jwt.sign({ userId:"legacy", email:"legacy@example.invalid", type:"session", jti:"legacy" },secret,{issuer:baseURL,audience:baseURL,expiresIn:"1h"});
    await page.context().addCookies([{ name:"session", value:token, url:baseURL! }]);
    await page.route("**/api/auth/oidc?**", route => route.fulfill({status:200,body:"SSO required"}));
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/api\/auth\/oidc/);
  });
  test("should keep application roles and logout without immediate sign-in", async ({ page }) => {
    const seed=await seedTestData(page.request);
    await loginAsTestUser(page,seed);
    const me=await page.request.get("/api/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).id).toBe(seed.userId);
    const response=await page.request.post("/auth/logout",{headers:{origin:new URL(page.url()).origin,accept:"application/json"}});
    expect(response.status()).toBe(200);
    expect((await page.request.get("/api/me")).status()).toBe(401);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
  });
});
