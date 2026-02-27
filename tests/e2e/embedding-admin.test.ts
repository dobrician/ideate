import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test.describe("Embedding Admin Interactions", () => {
  test("embeddings page shows model migration section", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Migration section should be visible
    await expect(page.getByText(/model migration/i).first()).toBeVisible();
  });

  test("embeddings page shows migration progress", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Target model and progress should be visible
    await expect(page.getByText(/target model/i).first()).toBeVisible();
    await expect(page.getByText(/migration progress/i).first()).toBeVisible();
  });

  test("embeddings page shows coverage bars", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    // Progress bars should exist
    const progressBars = page.getByRole("progressbar");
    await expect(progressBars.first()).toBeVisible();
  });

  test("embeddings API returns migration status", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/embeddings");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("distribution");
    expect(body.status).toHaveProperty("targetModel");
    expect(body.status).toHaveProperty("progressPercent");
  });

  test("embeddings API requires admin auth", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/embeddings");
    expect(res.status()).toBe(401);
  });

  test("embeddings page shows model information", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await page.goto("/admin/embeddings");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/model information/i).first()).toBeVisible();
    await expect(page.getByText(/tfidf/i).first()).toBeVisible();
  });
});
