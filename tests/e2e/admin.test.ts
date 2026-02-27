import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let adminSeed: SeedData;

test.describe("Admin — Authenticated as admin", () => {
  test.beforeEach(async ({ page }) => {
    adminSeed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, adminSeed);
  });

  test("admin page loads with heading and stat cards", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i })
    ).toBeVisible();

    // Stat cards should be present
    await expect(page.getByText(/Users/i).first()).toBeVisible();
    await expect(page.getByText(/Projects/i).first()).toBeVisible();
  });

  test("analytics sub-page loads", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Analytics/i })
    ).toBeVisible();
  });

  test("performance sub-page loads", async ({ page }) => {
    await page.goto("/admin/performance");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Query Performance/i })
    ).toBeVisible();
  });

  test("admin page has navigation links to sub-pages", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    const analyticsLink = page.getByRole("link", { name: /Analytics/i });
    await expect(analyticsLink).toBeVisible();
    await expect(analyticsLink).toHaveAttribute("href", "/admin/analytics");

    const perfLink = page.getByRole("link", { name: /Query Performance/i });
    await expect(perfLink).toBeVisible();
    await expect(perfLink).toHaveAttribute("href", "/admin/performance");
  });
});

test.describe("Admin — Non-admin access denied", () => {
  let memberSeed: SeedData;

  test.beforeEach(async ({ page }) => {
    memberSeed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, memberSeed);
  });

  test("member sees access denied on admin page", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();

    // Should have a link back to dashboard
    await expect(
      page.getByRole("link", { name: /Dashboard/i })
    ).toBeVisible();
  });

  test("member sees access denied on analytics sub-page", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();
  });

  test("member sees access denied on performance sub-page", async ({ page }) => {
    await page.goto("/admin/performance");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();
  });
});

test.describe("Admin — Unauthenticated", () => {
  test("unauthenticated user is redirected to login from admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to login from admin analytics", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to login from admin performance", async ({ page }) => {
    await page.goto("/admin/performance");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
