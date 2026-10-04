import { test, expect } from "@playwright/test";

test("SSO is the sole entry and preserves the contribution context", async ({ page }) => {
  const destination = "/p/example-share?comments=open";
  await page.route("**/api/auth/oidc?**", route => route.fulfill({ body: "SSO entry captured" }));
  await page.goto(`/auth/login?redirect=${encodeURIComponent(destination)}`);
  await expect(page).toHaveURL(`/api/auth/oidc?redirect=${encodeURIComponent(destination)}`);
  await expect(page.locator("input, form")).toHaveCount(0);
});
