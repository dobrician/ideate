import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Proposal Creation Flow", () => {
  test("full flow: login → navigate → open sheet → submit → proposal appears", async ({
    page,
  }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Open proposal form via Sheet trigger button
    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    const sheet = page.locator("[data-slot='sheet-content']");
    await expect(sheet).toBeVisible({ timeout: 5000 });

    // Wait for CSRF token to hydrate before interacting with form
    await expect(
      sheet.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    // Fill in proposal details
    const titleInput = sheet.locator("#proposal-title").first();
    await titleInput.fill("E2E Full Flow Proposal");

    const descInput = sheet.locator("#proposal-description").first();
    await descInput.fill("Created during the full end-to-end flow test.");

    // Submit the form
    const submitBtn = sheet
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

    // Open the Sheet via "New" button (short text on mobile)
    const newBtn = page.getByRole("button", { name: /new/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    const sheet = page.locator("[data-slot='sheet-content']");
    await expect(sheet).toBeVisible({ timeout: 10000 });

    // Wait for CSRF token to hydrate
    await expect(
      sheet.locator("input[name='csrfToken']")
    ).not.toHaveValue("", { timeout: 5000 });

    // Fill and submit
    await sheet.locator("#proposal-title").fill("E2E Mobile Sheet Proposal");
    await sheet
      .locator("#proposal-description")
      .fill("Created from mobile sheet.");

    await sheet.getByRole("button", { name: /submit/i }).click();

    // Proposal should appear after sheet closes and page revalidates
    await expect(page.getByText("E2E Mobile Sheet Proposal")).toBeVisible({
      timeout: 15000,
    });
  });

  test("rejects proposal with title too short", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await newBtn.click();

    const sheet = page.locator("[data-slot='sheet-content']");
    await expect(sheet).toBeVisible({ timeout: 5000 });

    await expect(
      sheet.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    const titleInput = sheet.locator("#proposal-title").first();
    await titleInput.fill("Hi");

    const submitBtn = sheet
      .getByRole("button", { name: /submit/i })
      .first();
    await submitBtn.click();

    // Client-side validation prevents submission — field keeps value
    await expect(titleInput).toHaveValue("Hi");
  });

  test("submits proposal with contra initial vote", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const newBtn = page.getByRole("button", { name: /new proposal/i });
    await newBtn.click();

    const sheet = page.locator("[data-slot='sheet-content']");
    await expect(sheet).toBeVisible({ timeout: 5000 });

    await expect(
      sheet.locator("input[name='csrfToken']").first()
    ).not.toHaveValue("", { timeout: 5000 });

    // Click the Contra vote button before submitting
    const contraBtn = sheet
      .getByRole("button", { name: /contra/i })
      .first();
    await contraBtn.click();

    // Hidden input should reflect the contra vote
    const voteInput = sheet.locator("input[name='initialVote']");
    await expect(voteInput).toHaveValue("-1");

    await sheet.locator("#proposal-title").first().fill("E2E Contra Proposal");
    await sheet
      .locator("#proposal-description")
      .first()
      .fill("Testing contra vote.");

    await sheet.getByRole("button", { name: /submit/i }).first().click();

    await expect(page.getByText("E2E Contra Proposal")).toBeVisible({
      timeout: 15000,
    });
  });
});
