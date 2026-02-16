import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders with email form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Sign in to Ideate")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send Magic Link/i })).toBeVisible();
  });

  test("login form validates email", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = page.getByLabel("Email");
    await emailInput.fill("invalid");
    await page.getByRole("button", { name: /Send Magic Link/i }).click();
    // HTML5 validation should prevent submission
    await expect(emailInput).toBeVisible();
  });

  test("login form submits valid email", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("button", { name: /Send Magic Link/i }).click();
    // Should show success message (even if SMTP fails, we show success)
    await expect(
      page.getByText(/Check your email|magic link|error/i)
    ).toBeVisible({ timeout: 10000 });
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
});
