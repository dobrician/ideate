import { test, expect, devices } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let seed: SeedData;

test.describe("Dashboard — Authenticated", () => {
  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
  });

  test("dashboard loads with stat cards and content sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    const statsRegion = page.getByRole("region", { name: /Your statistics/i }).first();
    await expect(statsRegion).toBeVisible();
    // Scope to visible desktop card titles (mobile pills use sm:hidden)
    await expect(statsRegion.getByText(/My Projects/i).first()).toBeVisible();
    await expect(statsRegion.getByText(/My Proposals/i).first()).toBeVisible();
    await expect(page.getByText(/Recent Votes/i).first()).toBeVisible();
    await expect(page.getByText(/Recent Activity/i).first()).toBeVisible();
  });

  test("quick actions buttons present and navigable", async ({ page }) => {
    const newProject = page.getByRole("link", { name: /New Project/i });
    await expect(newProject).toBeVisible();
    await expect(newProject).toHaveAttribute("href", "/projects/new");

    const browse = page.getByRole("link", { name: /Browse Projects/i });
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("href", "/projects");
  });

  test("user projects section shows seeded project with deadline badge", async ({ page }) => {
    // The seeded project has a 30-day deadline so it should show a green badge
    const projectsCard = page.locator("text=My Projects").locator("..").locator("..").locator("..");
    await expect(projectsCard.getByText(/E2E Test Project/i).first()).toBeVisible();
    // Deadline badge should be present (30d left = green)
    await expect(projectsCard.getByText(/d left/i).first()).toBeVisible();
  });

  test("recent votes section shows seeded vote", async ({ page }) => {
    await expect(page.getByText(/Initial Test Proposal/i).first()).toBeVisible();
  });

  test("new project quick action navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /New Project/i }).click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });

  test("browse projects quick action navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Browse Projects/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});

test.describe("Dashboard — Empty state", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("Dashboard — Mobile viewport", () => {
  const { defaultBrowserType: _, ...iPhone13 } = devices["iPhone 13"];
  test.use({ ...iPhone13 });

  test.beforeAll(async ({ request }) => {
    seed = await seedTestData(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, seed);
  });

  test("compact stat pills visible on mobile", async ({ page }) => {
    // Mobile pills should be visible (sm:hidden means visible on mobile)
    const statsRegion = page.getByRole("region", { name: /Your statistics/i }).first();
    await expect(statsRegion).toBeVisible();
    // Should show My Projects, My Proposals etc as pill text
    await expect(statsRegion.getByText(/My Projects/i)).toBeVisible();
    await expect(statsRegion.getByText(/My Votes/i)).toBeVisible();
  });

  test("mobile search button is accessible", async ({ page }) => {
    const searchBtn = page.getByRole("button", { name: /Search/i });
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    // After clicking, the search bar overlay should appear
    await expect(page.getByPlaceholder(/Search/i).last()).toBeVisible();
  });
});
