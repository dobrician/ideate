import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Proposal Creation Flow", () => {
  test("full flow: login → navigate → submit → proposal appears", async ({
    page,
  }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Sidebar with inline proposal form should be visible on desktop
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();

    // Wait for CSRF token to hydrate before interacting with form
    await expect(
      sidebar.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    // Fill in proposal details
    const titleInput = sidebar.locator("#proposal-title").first();
    await titleInput.fill("E2E Full Flow Proposal");

    const descInput = sidebar.locator("#proposal-description").first();
    await descInput.fill("Created during the full end-to-end flow test.");

    // Submit the form
    const submitBtn = sidebar
      .getByRole("button", { name: /submit/i })
      .first();
    await submitBtn.click();

    // Proposal should appear in the proposals list after server revalidation
    await expect(page.getByText("E2E Full Flow Proposal")).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates proposal via mobile dialog", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Desktop sidebar should be hidden on mobile
    await expect(page.locator("aside")).toBeHidden();

    // Open the dialog via "New Proposal" button
    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    const dialog = page.locator("[data-slot='dialog-content']");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Wait for CSRF token to hydrate
    await expect(
      dialog.locator("input[name='csrfToken']")
    ).not.toHaveValue("", { timeout: 5000 });

    // Fill and submit
    await dialog.locator("#proposal-title").fill("E2E Mobile Dialog Proposal");
    await dialog
      .locator("#proposal-description")
      .fill("Created from mobile dialog.");

    await dialog.getByRole("button", { name: /submit/i }).click();

    // Proposal should appear after dialog closes and page revalidates
    await expect(page.getByText("E2E Mobile Dialog Proposal")).toBeVisible({
      timeout: 15000,
    });
  });

  test("rejects proposal with title too short", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const sidebar = page.locator("aside").first();
    await expect(
      sidebar.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    const titleInput = sidebar.locator("#proposal-title").first();
    await titleInput.fill("Hi");

    const submitBtn = sidebar
      .getByRole("button", { name: /submit/i })
      .first();
    await submitBtn.click();

    // Browser minLength=5 validation prevents submission — field keeps value
    await expect(titleInput).toHaveValue("Hi");
  });

  test("submits proposal with contra initial vote", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const sidebar = page.locator("aside").first();
    await expect(
      sidebar.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    // Click the Contra vote button before submitting
    const contraBtn = sidebar
      .getByRole("button", { name: /contra/i })
      .first();
    await contraBtn.click();

    // Hidden input should reflect the contra vote
    const voteInput = sidebar.locator("input[name='initialVote']");
    await expect(voteInput).toHaveValue("-1");

    await sidebar.locator("#proposal-title").first().fill("E2E Contra Proposal");
    await sidebar
      .locator("#proposal-description")
      .first()
      .fill("Testing contra vote.");

    await sidebar.getByRole("button", { name: /submit/i }).first().click();

    await expect(page.getByText("E2E Contra Proposal")).toBeVisible({
      timeout: 15000,
    });
  });
});
