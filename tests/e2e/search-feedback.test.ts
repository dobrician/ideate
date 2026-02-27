import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Search Feedback Analytics", () => {
  test("admin search analytics page loads feedback section", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Search analytics header should be visible
    await expect(page.getByText(/search analytics/i).first()).toBeVisible();
    // Feedback section should be visible
    await expect(page.getByText(/search feedback/i).first()).toBeVisible();
  });

  test("search feedback section shows quality by mode", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Quality by mode heading
    await expect(page.getByText(/quality by search mode/i).first()).toBeVisible();
  });

  test("search feedback section shows feedback trend", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Trend heading
    await expect(page.getByText(/feedback trend/i).first()).toBeVisible();
  });

  test("search feedback section shows low-rated results", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Low rated heading
    await expect(page.getByText(/low-rated results/i).first()).toBeVisible();
  });

  test("search feedback shows total and rate cards", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Summary cards
    await expect(page.getByText(/total feedback/i).first()).toBeVisible();
    await expect(page.getByText(/positive rate/i).first()).toBeVisible();
  });

  test("non-admin cannot access search analytics", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Should show access denied
    await expect(page.getByText(/access denied/i).first()).toBeVisible();
  });
});
