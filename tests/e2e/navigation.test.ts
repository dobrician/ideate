import { test, expect } from "@playwright/test";

test.describe("Navigation & Public Pages", () => {
  test("homepage shows welcome content and feature cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Ideate")).toBeVisible();
    await expect(page.getByText("Projects")).toBeVisible();
    await expect(page.getByText("Proposals")).toBeVisible();
    await expect(page.getByText("Consensus")).toBeVisible();
  });

  test("homepage has navigation buttons", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /View Projects/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Dashboard/i })
    ).toBeVisible();
  });

  test("header shows app name and search bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Ideate" })).toBeVisible();
  });

  test("health endpoint returns valid JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("database");
    expect(body).toHaveProperty("timestamp");
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-12345");
    expect(response?.status()).toBe(404);
  });

  test("robots.txt is accessible", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain("User-agent");
  });

  test("manifest.json is accessible", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.name).toContain("Ideate");
    expect(body.start_url).toBe("/");
  });

  test("offline page is accessible", async ({ request }) => {
    const response = await request.get("/offline.html");
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain("Offline");
  });
});
