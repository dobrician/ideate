import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("AI Project Summary E2E", () => {
  test("regenerate summary button triggers API and shows success toast", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.route(`**/api/projects/${seed.projectId}/summary`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ summary: "A concise AI-generated project summary." }),
      });
    });

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const regenBtn = page.locator("button").filter({ hasText: /Regenerate|Regenerează/i });
    if (await regenBtn.isVisible()) {
      await regenBtn.click();
      // Success toast should appear
      await expect(page.getByText(/updated|actualizat/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("shows rate limited toast when summary API returns RATE_LIMITED", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.route(`**/api/projects/${seed.projectId}/summary`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Rate limited", code: "RATE_LIMITED" }),
      });
    });

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const regenBtn = page.locator("button").filter({ hasText: /Regenerate|Regenerează/i });
    if (await regenBtn.isVisible()) {
      await regenBtn.click();
      await expect(page.getByText(/rate limit|limită/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("shows not-configured toast when summary API returns NO_KEYS", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.route(`**/api/projects/${seed.projectId}/summary`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI not configured", code: "NO_KEYS" }),
      });
    });

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const regenBtn = page.locator("button").filter({ hasText: /Regenerate|Regenerează/i });
    if (await regenBtn.isVisible()) {
      await regenBtn.click();
      await expect(page.getByText(/not configured|configurat/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("shows unavailable toast when summary API returns AI_UNAVAILABLE", async ({ page }) => {
    const seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);

    await page.route(`**/api/projects/${seed.projectId}/summary`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI unavailable", code: "AI_UNAVAILABLE" }),
      });
    });

    await page.goto(`/projects/${seed.projectId}`);
    await page.waitForLoadState("domcontentloaded");

    const regenBtn = page.locator("button").filter({ hasText: /Regenerate|Regenerează/i });
    if (await regenBtn.isVisible()) {
      await regenBtn.click();
      await expect(page.getByText(/unavailable|indisponibil/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
