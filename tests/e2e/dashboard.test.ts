import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Single Projects home", () => {
  test("old dashboard links redirect to useful projects on desktop and mobile", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await expect(page.getByText("E2E Test Project").first()).toBeVisible();
    await expect(page.getByRole("region", { name: /Your statistics/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Dashboard/ })).toHaveCount(0);
  });
  test("unauthenticated bookmarks still lead to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
  test("account has no duplicate project or proposal tabs", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByLabel(/First Name/)).toBeVisible();
    await page.locator("details > summary").filter({ hasText: "Email Notifications" }).click();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });
});
