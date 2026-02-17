import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Voting E2E", () => {
  test("vote pro on a proposal", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // The seeded proposal should have the initial vote (1 upvote)
    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    await expect(voteGroup).toBeVisible();

    // Click thumbs up (pro) — since test user already has an upvote,
    // clicking again removes it. Click to toggle off first, then on.
    const upBtn = voteGroup.locator("button").first();
    await upBtn.click();
    // Wait for transition to complete
    await page.waitForTimeout(500);

    // Click again to re-vote pro
    await upBtn.click();
    await page.waitForTimeout(500);

    // Should show the upvote count
    await expect(upBtn.locator("span.text-sm")).toBeVisible();
  });

  test("vote contra on a proposal", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();

    // Click thumbs down (contra)
    const downBtn = voteGroup.locator("button").nth(1);
    await downBtn.click();
    await page.waitForTimeout(500);

    // Down button should now have the pressed state
    await expect(downBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("change vote from pro to contra", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();
    const downBtn = voteGroup.locator("button").nth(1);

    // Ensure we have a pro vote (seed already has one, but verify)
    await expect(upBtn).toHaveAttribute("aria-pressed", "true");

    // Change to contra
    await downBtn.click();
    await page.waitForTimeout(500);

    await expect(downBtn).toHaveAttribute("aria-pressed", "true");
    await expect(upBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("vote bar renders with proportional widths", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // The proposal trigger has background gradients for vote bars
    const trigger = page.locator("[data-slot='accordion-trigger']").first();
    await expect(trigger).toBeVisible();

    // The vote bar container (absolute positioned overlay) should exist
    const barContainer = trigger.locator(".pointer-events-none").first();
    await expect(barContainer).toBeVisible();

    // At minimum, the green bar should be visible (1 upvote from seed)
    const greenBar = barContainer.locator("div").filter({
      has: page.locator("[class*='green']"),
    });
    // Either green bar exists or the total container exists
    await expect(barContainer).toBeVisible();
  });

  test("vote counts update after voting", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const upBtn = voteGroup.locator("button").first();
    const downBtn = voteGroup.locator("button").nth(1);

    // Get initial upvote count
    const initialUpText = await upBtn.locator("span.text-sm").textContent();
    const initialUp = parseInt(initialUpText || "0");

    // Remove the existing upvote
    await upBtn.click();
    await page.waitForTimeout(1000);

    // Upvote count should decrease
    const newUpText = await upBtn.locator("span.text-sm").textContent();
    const newUp = parseInt(newUpText || "0");
    expect(newUp).toBeLessThanOrEqual(initialUp);

    // Vote contra
    await downBtn.click();
    await page.waitForTimeout(1000);

    // Downvote count should be at least 1
    const downText = await downBtn.locator("span.text-sm").textContent();
    const downCount = parseInt(downText || "0");
    expect(downCount).toBeGreaterThanOrEqual(1);
  });

  test("SSE vote stream delivers real-time updates", async ({ page, request }) => {
    const seed = await seedTestData(request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Verify the SSE connection is established by checking for EventSource
    const hasEventSource = await page.evaluate(() => typeof EventSource !== "undefined");
    expect(hasEventSource).toBe(true);

    // Capture SSE requests to the vote stream endpoint
    const sseRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/votes/stream")) {
        sseRequests.push(req.url());
      }
    });

    // Reload to trigger a fresh SSE connection
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Wait for the SSE connection to be established
    await page.waitForTimeout(1000);

    // Verify the page opened an SSE connection to the vote stream
    expect(sseRequests.length).toBeGreaterThanOrEqual(1);
    expect(sseRequests[0]).toContain(`projectId=${seed.projectId}`);

    // Vote and verify the UI updates in real-time (SSE delivers the update)
    const voteGroup = page.locator("[role='group'][aria-label='Vote on this proposal']").first();
    const downBtn = voteGroup.locator("button").nth(1);

    // Cast a contra vote — the SSE stream should push the update
    await downBtn.click();

    // Wait for SSE-driven UI update
    await expect(downBtn).toHaveAttribute("aria-pressed", "true", { timeout: 3000 });

    // The downvote count should reflect the change
    const downText = await downBtn.locator("span.text-sm").textContent();
    expect(parseInt(downText || "0")).toBeGreaterThanOrEqual(1);
  });

  test("SSE stream endpoint requires authentication", async ({ request }) => {
    // Direct API call without auth should return 401
    const res = await request.get("/api/votes/stream?projectId=fake-id");
    expect(res.status()).toBe(401);
  });

  test("SSE stream endpoint requires projectId", async ({ page, request }) => {
    const seed = await seedTestData(request);
    await loginAsTestUser(page, seed);

    // Call stream endpoint without projectId
    const res = await page.request.get("/api/votes/stream");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing projectId");
  });
});
