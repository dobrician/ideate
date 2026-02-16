import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Project Detail Page", () => {
  test("displays project title and status badge", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Title is in a CardTitle div
    await expect(page.getByText(/E2E Test Project/)).toBeVisible();

    // Status badge shows "Active"
    await expect(page.getByText("Active").first()).toBeVisible();
  });

  test("shows proposals section with count", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/Proposals?\s*\(\d+\)/)).toBeVisible();
  });

  test("shows project comment section", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const commentSection = page.getByText("Project Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();
    await expect(commentSection).toBeVisible();

    const textarea = page.locator("textarea[name='content']").last();
    await expect(textarea).toBeVisible();
  });

  test("shows back link to projects list", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const backLink = page.getByRole("link", { name: /back/i }).first();
    await expect(backLink).toBeVisible();
  });
});

test.describe("Proposal Creation Flow", () => {
  test("creates proposal via inline form (desktop)", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Target the sidebar aside form
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    const titleInput = sidebar.locator("#proposal-title");
    await titleInput.fill("E2E Desktop Proposal");

    const descInput = sidebar.locator("#proposal-description");
    await descInput.fill("Created by E2E test on desktop viewport.");

    const submitBtn = sidebar.getByRole("button", { name: /submit/i });
    await submitBtn.click();

    // Proposal should appear in the accordion
    await expect(
      page.getByText("E2E Desktop Proposal")
    ).toBeVisible({ timeout: 15000 });
  });

  test("creates proposal via dialog (mobile)", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await newBtn.click();

    const dialog = page.locator("[data-slot='dialog-content']");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.locator("#proposal-title").fill("E2E Mobile Proposal");
    await dialog.locator("#proposal-description").fill("From mobile.");

    await dialog.getByRole("button", { name: /submit/i }).click();

    await expect(
      page.getByText("E2E Mobile Proposal")
    ).toBeVisible({ timeout: 15000 });
  });

  test("rejects short proposal title via browser validation", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const sidebar = page.locator("aside");
    const titleInput = sidebar.locator("#proposal-title");
    await titleInput.fill("Hi");

    const submitBtn = sidebar.getByRole("button", { name: /submit/i });
    await submitBtn.click();

    // Browser minlength validation keeps the field visible with original value
    await expect(titleInput).toHaveValue("Hi");
  });
});

test.describe("Mobile Viewport", () => {
  test("hides inline sidebar form on mobile", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const aside = page.locator("aside");
    await expect(aside).toBeHidden();

    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await expect(newBtn).toBeVisible();
  });

  test("comment section fits within mobile viewport", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const commentSection = page.getByText("Project Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();

    // min(400px, 50vh) at 667px viewport = 333.5px
    const commentBox = page.locator("[class*='min(400px']");
    const box = await commentBox.boundingBox();
    if (box) {
      expect(box.height).toBeLessThanOrEqual(340);
    }
  });

  test("project title is visible on mobile", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/E2E Test Project/)).toBeVisible();
  });
});
