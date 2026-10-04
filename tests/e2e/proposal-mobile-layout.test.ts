import { expect, test } from "@playwright/test";
import { loginAsTestUser, seedTestData } from "./helpers";

for (const width of [320, 390, 430]) {
  test(`should keep proposal controls in one compact row at ${width}px`, async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/projects/${seed.projectId}`);
    const idea = page.locator('[data-slot="accordion-item"]').first();
    const title = idea.locator('[data-slot="accordion-trigger"]');
    const controls = idea.locator('[data-proposal-controls]');
    const chart = idea.locator('[data-vote-chart]');
    await expect(title).toBeVisible();
    const titleBox = (await title.boundingBox())!;
    const controlBox = (await controls.boundingBox())!;
    expect(Math.abs(titleBox.y - controlBox.y)).toBeLessThanOrEqual(1);
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(controlBox.x);
    expect((await chart.boundingBox())!.height).toBe(60);
    expect((await idea.boundingBox())!.height).toBeLessThanOrEqual(62);
    for (const button of await controls.getByRole("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await title.click();
    await expect(idea).toHaveAttribute("data-state", "open");
    await expect(idea.locator('[data-slot="accordion-content"]').getByText("A proposal seeded for E2E testing", { exact: true })).toBeVisible();
    expect((await chart.boundingBox())!.height).toBe(60);
    await title.click();
    await expect(idea).toHaveAttribute("data-state", "closed");
    await idea.getByRole("button", { name: "Attachments", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Attachments", exact: true })).toBeVisible();
    await expect(idea).toHaveAttribute("data-state", "closed");
  });
}
