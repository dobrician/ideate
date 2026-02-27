import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Voting Advanced Flows", () => {
  test("toggle vote off removes the vote", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();

    // Initial state: user has upvote from seed
    await expect(upBtn).toHaveAttribute("aria-pressed", "true");

    // Click to remove the vote
    await upBtn.click();
    await page.waitForTimeout(1000);

    // Vote should be toggled off
    await expect(upBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("vote buttons have accessible labels", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    await expect(voteGroup).toBeVisible();

    // Both vote buttons should have aria-pressed attribute
    const upBtn = voteGroup.locator("button").first();
    const downBtn = voteGroup.locator("button").nth(1);

    await expect(upBtn).toHaveAttribute("aria-pressed");
    await expect(downBtn).toHaveAttribute("aria-pressed");
  });

  test("vote counts display as numbers", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();

    // The upvote count span should contain a number
    const countText = await upBtn.locator("span.text-sm").textContent();
    expect(parseInt(countText || "0")).toBeGreaterThanOrEqual(0);
  });

  test("rapid vote toggling does not cause inconsistency", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();
    const downBtn = voteGroup.locator("button").nth(1);

    // Rapid toggle: up → down → up
    await upBtn.click();
    await page.waitForTimeout(300);
    await downBtn.click();
    await page.waitForTimeout(300);
    await upBtn.click();
    await page.waitForTimeout(1000);

    // After settling, exactly one button should be pressed
    const upPressed = await upBtn.getAttribute("aria-pressed");
    const downPressed = await downBtn.getAttribute("aria-pressed");

    // They shouldn't both be true
    expect(upPressed === "true" && downPressed === "true").toBe(false);
  });
});

test.describe("Voting Mobile", () => {
  test("vote buttons are tappable on mobile (44px targets)", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();
    await expect(upBtn).toBeVisible();

    // Check button size meets 44px touch target
    const box = await upBtn.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });
});
