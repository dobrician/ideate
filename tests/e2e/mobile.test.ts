import { test, expect, devices } from "@playwright/test";

const MIN_TAP = 44;

test.describe("Mobile — Touch Targets & Overflow (Sprint 28)", () => {
  test.use({ ...devices["iPhone 13"] });

  test("login page links meet 44px touch targets", async ({ page }) => {
    await page.goto("/auth/login");

    // Forgot password link
    const forgot = page.getByRole("link", { name: /Forgot/i });
    await expect(forgot).toBeVisible();
    const forgotBox = await forgot.boundingBox();
    expect(forgotBox!.height).toBeGreaterThanOrEqual(MIN_TAP);

    // Register link
    const register = page.getByRole("link", { name: /Create Account/i });
    await expect(register).toBeVisible();
    const regBox = await register.boundingBox();
    expect(regBox!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test("register page login link meets 44px touch target", async ({
    page,
  }) => {
    await page.goto("/auth/register");
    const login = page.getByRole("link", { name: /Sign in/i });
    await expect(login).toBeVisible();
    const box = await login.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test("forgot-password back link meets 44px touch target", async ({
    page,
  }) => {
    await page.goto("/auth/forgot-password");
    const back = page.getByRole("link", { name: /Back to login/i });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test("homepage has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("login page card fits within mobile viewport", async ({ page }) => {
    await page.goto("/auth/login");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("mobile nav bar does not overflow viewport", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByLabel("Mobile navigation");
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const viewport = page.viewportSize()!;
    expect(navBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });
});
