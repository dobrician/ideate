import { test, expect } from "@playwright/test";

test("homepage loads and shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Ideate/);
  await expect(page.getByText("Welcome to Ideate")).toBeVisible();
});

test("health check returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.status).toBe("healthy");
  expect(body.database).toBe("ok");
});
