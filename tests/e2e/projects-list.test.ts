import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let seed: SeedData;

test.describe("Projects List Page", () => {
  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
  });

  test("projects page loads and shows heading", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");
    // Should contain a heading related to projects
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("projects page has at least one project card", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");
    // The seeded project should appear
    await expect(page.getByText(/E2E Test Project/).first()).toBeVisible({ timeout: 10000 });
  });

  test("clicking a project navigates to detail page", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");
    // Click the seeded project link
    const projectLink = page.getByText(/E2E Test Project/).first();
    await projectLink.click();
    await page.waitForLoadState("domcontentloaded");
    // Should be on project detail page
    expect(page.url()).toContain("/projects/");
  });

  test("new project button is visible", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");
    // Look for "New Project" or "Create" button/link
    const newBtn = page.getByRole("link", { name: /new|create/i }).first();
    await expect(newBtn).toBeVisible();
  });
});
