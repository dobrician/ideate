import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Decision-focused workflow", () => {
  test("should show summaries and voting totals to shared-link guests and require login to vote", async ({ page, browser }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto(`/projects/${seed.projectId}`);
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const share = page.getByRole("dialog", { name: "Share this project", exact: true });
    await share.getByRole("button", { name: "Generate link", exact: true }).click();
    const link = share.getByLabel("Public share link", { exact: true });
    await expect(link).toHaveValue(/\/p\/.+/);
    const guestContext = await browser.newContext({ viewport: page.viewportSize() });
    try {
      const guest = await guestContext.newPage();
      await guest.goto(await link.inputValue());
      await expect(guest.getByLabel("Voting so far")).toContainText("1 vote cast");
      await expect(guest.getByText("Initial Test Proposal")).toBeVisible();
      await expect(guest.getByText("Test proposal for automated E2E tests")).toBeVisible();
      await expect(guest.getByRole("button", { name: /New Proposal/ })).toHaveCount(0);
      await guest.getByRole("button", { name: /^Pro \(/ }).click();
      await expect(guest).toHaveURL(/\/auth\/login/);
    } finally {
      await guestContext.close();
    }
  });
  test("should put the first idea and vote controls in the initial viewport", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto(`/projects/${seed.projectId}`);
    const idea = page.locator('[data-slot="accordion-item"]').first();
    await expect(idea.getByText("Initial Test Proposal")).toBeVisible();
    await expect(idea.getByText("Test proposal for automated E2E tests")).toBeVisible();
    const vote = idea.getByRole("button", { name: /^Pro \(/ });
    await expect(vote).toBeInViewport();
    await expect(page.getByRole("button", { name: /PDF|CSV/i })).toHaveCount(0);
    await expect(page.getByText("Created", { exact: true })).not.toBeVisible();
  await expect(page.getByLabel("Voting so far")).toContainText("1 vote cast");
  await expect(page.getByRole("heading", { name: /Proposals/ })).toHaveCount(0);
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: "Context & details", exact: true }).click();
  await expect(page.getByText("Created", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Last Updated", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Context & details", exact: true }).click();
  await vote.click();
    await expect(vote).toHaveAttribute("aria-pressed", "false");
    await vote.click();
    await expect(vote).toHaveAttribute("aria-pressed", "true");
  });

  test("should take members directly from home to projects", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.goto("/");
    await expect(page).toHaveURL(/\/projects$/);
    const project = page.getByRole("link", { name: /E2E Test Project/ }).first();
    await expect(project).toContainText("1 proposal");
    await expect(project).toContainText("1 vote cast");
  });
});


test("should preserve the first preview outside the list and keep attachments independent", async ({ page, isMobile }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  const idea = page.locator('[data-slot="accordion-item"]').first();
  const summary = idea.getByText("Test proposal for automated E2E tests");
  await expect(summary).toBeVisible();
  const initialHeight = (await idea.boundingBox())!.height;
  if (isMobile) await idea.getByRole("button", { name: /^Pro \(/ }).focus();
  else await page.getByRole("heading", { level: 1 }).hover();
  await expect(summary).toBeVisible();
  await expect.poll(async () => (await idea.boundingBox())!.height).toBe(initialHeight);
  await idea.getByRole("button", { name: "Attachments", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Attachments", exact: true })).toBeVisible();
  await expect(idea).toHaveAttribute("data-state", "closed");
});

test("should suggest details after a prolonged hover without moving the list", async ({ page, isMobile }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  const idea = page.locator('[data-slot="accordion-item"]').first();
  const trigger = idea.locator('[data-slot="accordion-trigger"]');
  await expect(trigger.locator("svg")).toHaveCount(0);
  await expect(trigger).toHaveCSS("cursor", "pointer");
  const height = (await idea.boundingBox())!.height;
  if (!isMobile) {
    await trigger.hover();
    await expect.poll(() => idea.evaluate(el => getComputedStyle(el, "::after").opacity)).toBe("1");
    await expect.poll(async () => (await idea.boundingBox())!.height).toBe(height);
  }
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(idea).toHaveAttribute("data-state", "open");
});

test("should transfer the preview intentionally and retain it outside the list", async ({ page, isMobile }) => {
  await page.route("**/api/proposals/similarity", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }),
  }));
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  await page.getByRole("button", { name: /New Proposal/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet.locator('input[name="csrfToken"]')).not.toHaveValue("");
  await sheet.locator("#proposal-title").fill("Second preview idea");
  await sheet.locator("#proposal-description").fill("A short second summary.");
  await sheet.getByRole("button", { name: /submit/i }).click();
  await expect(sheet).not.toBeVisible();
  const ideas = page.locator('[data-slot="accordion-item"]');
  await expect(ideas).toHaveCount(2);
  await page.reload();
  await expect(ideas.first()).toHaveAttribute("data-preview-active", "true");
  const second = ideas.nth(1);
  if (isMobile) await second.locator('[data-slot="accordion-trigger"]').focus();
  else await second.locator('[data-slot="accordion-trigger"]').hover();
  await expect(second).toHaveAttribute("data-preview-active", "true");
  await expect(ideas.first()).toHaveAttribute("data-preview-active", "false");
  if (isMobile) await page.getByRole("button", { name: "More actions", exact: true }).focus();
  else await page.getByRole("heading", { level: 1 }).hover();
  await expect(second).toHaveAttribute("data-preview-active", "true");
});


test("should preserve closed-project results while hiding contribution controls", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit Project", exact: true });
  await edit.locator('select[name="status"]').selectOption("archived");
  await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(page.getByLabel("Voting so far")).toContainText("1 vote cast");
  await expect(page.getByRole("button", { name: /^Pro \(/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /New Proposal|Open discussion/ })).toHaveCount(0);
  await expect(page.locator('textarea[name="content"]')).toHaveCount(0);
});
