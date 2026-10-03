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
    await expect(idea.getByText("Test proposal for automated E2E tests")).toBeVisible();
    const vote = idea.getByRole("button", { name: /^Pro \(/ });
    await expect(vote).toBeInViewport();
    await expect(page.getByRole("button", { name: /PDF|CSV/i })).toHaveCount(0);
    await expect(page.getByText("Created", { exact: true })).not.toBeVisible();
    await expect(page.getByLabel("Voting so far")).toContainText("1 vote cast");
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
