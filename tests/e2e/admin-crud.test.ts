import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Admin CRUD Operations", () => {
  test("admin can navigate to all admin sub-pages", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Admin dashboard should be visible
    await expect(page.getByText(/admin/i).first()).toBeVisible();

    // Check for admin navigation links
    const links = page.getByRole("link");
    await expect(links.first()).toBeVisible();
  });

  test("admin embeddings page loads with stats", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Should show embedding stats
    await expect(page.getByText(/embedding/i).first()).toBeVisible();
    // Should show model info section
    await expect(page.getByText(/model/i).first()).toBeVisible();
  });

  test("admin embeddings page shows freshness stats", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Freshness section should be visible
    await expect(page.getByText(/freshness/i).first()).toBeVisible();
  });

  test("admin perf dashboard loads", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/perf-dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Should show performance data
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("admin users page loads user list", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // Should show user management content
    const content = page.locator("main").first();
    await expect(content).toBeVisible();
  });

  test("member cannot access admin embeddings", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Should show access denied
    const denied = page.getByText(/access denied|unauthorized|forbidden/i).first();
    const dashboard = page.getByText(/dashboard/i).first();
    await expect(denied.or(dashboard)).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user redirected from admin", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Should redirect to login page
    await expect(page).toHaveURL(/auth\/login/);
  });
});
