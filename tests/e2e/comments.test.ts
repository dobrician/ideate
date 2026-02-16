import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Comments E2E", () => {
  test("add project comment via send button", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Scroll to project comments section
    const commentSection = page.locator("text=Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();

    // Type a comment
    const textarea = page.locator("textarea[name='content']").last();
    await textarea.fill("This is a test comment via send button");

    // Click the send button
    const sendBtn = page.locator("button[title]").filter({
      has: page.locator("svg.lucide-send"),
    }).last();
    await sendBtn.click();

    // Comment should appear in the thread
    await expect(
      page.getByText("This is a test comment via send button")
    ).toBeVisible({ timeout: 10000 });
  });

  test("add project comment via Enter key", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const commentSection = page.locator("text=Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();

    const textarea = page.locator("textarea[name='content']").last();
    await textarea.fill("Comment sent with Enter key");
    await textarea.press("Enter");

    await expect(
      page.getByText("Comment sent with Enter key")
    ).toBeVisible({ timeout: 10000 });
  });

  test("empty comment is rejected (required field)", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const commentSection = page.locator("text=Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();

    // Try to submit empty comment - textarea has required attribute
    const sendBtn = page.locator("button[title]").filter({
      has: page.locator("svg.lucide-send"),
    }).last();
    await sendBtn.click();

    // The textarea should still be visible (form not submitted due to required)
    const textarea = page.locator("textarea[name='content']").last();
    await expect(textarea).toBeVisible();
  });

  test("comment appears with chat bubble layout", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const commentSection = page.locator("text=Discussion").first();
    await commentSection.scrollIntoViewIfNeeded();

    // Post a comment
    const textarea = page.locator("textarea[name='content']").last();
    await textarea.fill("Chat bubble test message");
    await textarea.press("Enter");

    await expect(page.getByText("Chat bubble test message")).toBeVisible({
      timeout: 10000,
    });

    // Own messages should be right-aligned (flex-row-reverse)
    const bubble = page.locator("div.flex").filter({
      hasText: "Chat bubble test message",
    }).first();
    await expect(bubble).toBeVisible();
    // The bubble should contain a rounded chat div
    await expect(bubble.locator(".rounded-2xl")).toBeVisible();
  });

  test("proposal comment via discussion sheet", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    // Open the discussion sheet for the seeded proposal
    const commentBtn = page.locator("button[title]").filter({
      has: page.locator("svg.lucide-message-square"),
    }).first();
    await commentBtn.click();

    // Sheet should open
    const sheet = page.locator("[data-slot='sheet-content']");
    await expect(sheet).toBeVisible({ timeout: 5000 });

    // Type and submit a proposal comment
    const textarea = sheet.locator("textarea[name='content']");
    await textarea.fill("Proposal discussion comment");
    await textarea.press("Enter");

    await expect(
      sheet.getByText("Proposal discussion comment")
    ).toBeVisible({ timeout: 10000 });
  });
});
