import { test, expect } from "@playwright/test";

test("SSO is the primary entry and contribution context survives intentional fallback", async ({ page }) => {
  const destination = "/p/example-share?comments=open";
  await page.goto(`/auth/login?redirect=${encodeURIComponent(destination)}`);
  const sso = page.getByRole("link", { name: "Sign in with SSO", exact: true });
  await expect(sso).toBeVisible();
  await expect(sso).toHaveAttribute("href", `/api/auth/oidc?redirect=${encodeURIComponent(destination)}`);
  await expect(page.getByLabel("Email", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Other ways to sign in", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with Password/i })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
