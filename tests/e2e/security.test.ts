import { test, expect } from "@playwright/test";

test.describe("Security Headers", () => {
  test("homepage returns security headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("CSP header is present", async ({ request }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("protected API returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/projects/test");
    expect(response.status()).toBe(401);
  });

  test("admin panel redirects non-admin users", async ({ page }) => {
    await page.goto("/admin");
    // Should redirect to login (not authenticated)
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
