import { test, expect, devices } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders with password form (default)", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Sign in to Ideate")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign In with Password/i })
    ).toBeVisible();
  });

  test("login page can switch to magic link mode", async ({ page }) => {
    await page.goto("/auth/login");
    await page
      .getByRole("button", { name: /Sign in with Magic Link/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Send Magic Link/i })
    ).toBeVisible();
  });

  test("login form validates email on password mode", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = page.getByLabel("Email");
    await emailInput.fill("invalid");
    await page.getByLabel("Password").fill("SomePass1");
    await page
      .getByRole("button", { name: /Sign In with Password/i })
      .click();
    // HTML5 validation should prevent submission
    await expect(emailInput).toBeVisible();
  });

  test("register page renders form fields", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create Account/i })
    ).toBeVisible();
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByText("Reset your password")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Send Reset Link/i })
    ).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("profile redirects unauthenticated users", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/auth/login");
    const regLink = page.getByRole("link", { name: /Create Account/i });
    await expect(regLink).toBeVisible();
    await expect(regLink).toHaveAttribute("href", "/auth/register");
  });

  test("login page has link to forgot password", async ({ page }) => {
    await page.goto("/auth/login");
    const fpLink = page.getByRole("link", { name: /Forgot/i });
    await expect(fpLink).toBeVisible();
    await expect(fpLink).toHaveAttribute("href", "/auth/forgot-password");
  });
});

test.describe("Authentication - Mobile Viewport", () => {
  test.use({ ...devices["iPhone 13"] });

  test("login page renders correctly on mobile", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Sign in to Ideate")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign In with Password/i })
    ).toBeVisible();
    // Card should be contained within viewport
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("register page renders correctly on mobile", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("forgot password page renders correctly on mobile", async ({
    page,
  }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByText("Reset your password")).toBeVisible();
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("mobile login can switch to magic link mode", async ({ page }) => {
    await page.goto("/auth/login");
    await page
      .getByRole("button", { name: /Sign in with Magic Link/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Send Magic Link/i })
    ).toBeVisible();
  });

  test("mobile protected routes redirect to login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
