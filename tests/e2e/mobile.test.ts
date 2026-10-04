import { test, expect, devices } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

const MIN_TAP = 44;

test.describe("Mobile — Touch Targets & Overflow (Sprint 28)", () => {
  const { defaultBrowserType: _, ...iPhone13 } = devices["iPhone 13"];
  test.use({ ...iPhone13 });

  test("homepage has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("login page card fits within mobile viewport", async ({ page }) => {
    await page.goto("/auth/login?error=oidc_error");
    const card = page.locator("[data-sso-retry]");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("mobile nav bar does not overflow viewport", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto("/projects");
    const nav = page.getByLabel("Main navigation");
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const viewport = page.viewportSize()!;
    expect(navBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });
});
