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
