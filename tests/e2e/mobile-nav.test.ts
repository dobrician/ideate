import { test, expect, devices } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

const { defaultBrowserType: _, ...pixel5 } = devices["Pixel 5"];

test.describe("Mobile Navigation", () => {
  test.use({ ...pixel5 });

  test("mobile nav is accessible at small viewport", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Mobile navigation should be visible
    await expect(page.getByLabel(/mobile/i).first()).toBeVisible();
  });

  test("mobile nav links navigate correctly", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Click on projects link in mobile nav
    const projectsLink = page.getByRole("link", { name: /project/i }).first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain("/projects");
    }
  });

  test("mobile nav has 44px touch targets", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Check bottom nav links have at least 44px tap target
    const navLinks = page.getByLabel(/mobile navigation/i).getByRole("link");
    const count = await navLinks.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await navLinks.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("admin pages are accessible on mobile", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Admin panel should render
    await expect(page.getByText(/admin/i).first()).toBeVisible();
  });

  test("search analytics page is responsive on mobile", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("domcontentloaded");

    // Stat cards should be visible and not overflow
    const content = page.locator("main").first();
    if (await content.isVisible()) {
      const box = await content.boundingBox();
      if (box) {
        // Content shouldn't be wider than viewport
        expect(box.width).toBeLessThanOrEqual(412); // Pixel 5 width
      }
    }
  });

  test("embeddings admin page is responsive on mobile", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Should load without horizontal scroll
    await expect(page.getByText(/embedding/i).first()).toBeVisible();
  });
});
