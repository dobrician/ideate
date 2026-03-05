import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, navigateAndWait } from "./helpers";

test.describe("Admin Export Endpoints", () => {
  test("search analytics export returns CSV with filters", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get(
      "/api/admin/export/search-analytics?days=7&mode=fts"
    );
    expect(res.ok()).toBe(true);

    const contentType = res.headers()["content-type"];
    expect(contentType).toContain("text/csv");

    const csv = await res.text();
    expect(csv).toContain("# Export Filters");
    expect(csv).toContain("# Search Analytics Summary");
  });

  test("search analytics export supports date-range params", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get(
      "/api/admin/export/search-analytics?startDate=2026-03-01&endDate=2026-03-05"
    );
    expect(res.ok()).toBe(true);

    const csv = await res.text();
    expect(csv).toContain("Start Date,2026-03-01");
    expect(csv).toContain("End Date,2026-03-05");
  });

  test("CI builds export returns CSV with branch filter", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get(
      "/api/admin/export/ci-builds?limit=10&branch=main"
    );
    expect(res.ok()).toBe(true);

    const contentType = res.headers()["content-type"];
    expect(contentType).toContain("text/csv");

    const csv = await res.text();
    expect(csv).toContain("# Export Filters");
    expect(csv).toContain("Branch,main");
  });

  test("export endpoints require admin auth", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const searchRes = await page.request.get("/api/admin/export/search-analytics");
    expect(searchRes.status()).toBe(401);

    const ciRes = await page.request.get("/api/admin/export/ci-builds");
    expect(ciRes.status()).toBe(401);
  });
});

test.describe("Embedding Quality Trends API", () => {
  test("quality trends API returns trend data", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/embeddings/quality-trends?days=30");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("trend");
    expect(body).toHaveProperty("summary");
    expect(Array.isArray(body.trend)).toBe(true);
    expect(body.summary).toHaveProperty("trend");
    expect(body.summary).toHaveProperty("snapshotCount");
  });

  test("quality trends POST takes a snapshot", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.post("/api/admin/embeddings/quality-trends");
    expect(res.ok()).toBe(true);
  });

  test("quality trends API requires admin auth", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/embeddings/quality-trends");
    expect(res.status()).toBe(401);
  });
});

test.describe("CI Regression Alerts API", () => {
  test("CI alerts API returns alerts and stats", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/ci-alerts");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("alerts");
    expect(body).toHaveProperty("stats");
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(body.stats).toHaveProperty("total");
    expect(body.stats).toHaveProperty("active");
  });

  test("CI alerts detect action works", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.post("/api/admin/ci-alerts", {
      data: { action: "detect" },
    });
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("alerts");
    expect(body).toHaveProperty("count");
  });

  test("CI alerts API requires admin auth", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/ci-alerts");
    expect(res.status()).toBe(401);
  });
});

test.describe("CI Build Comparison API", () => {
  test("comparison API returns available branches", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/ci-builds/compare");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("branches");
    expect(Array.isArray(body.branches)).toBe(true);
  });

  test("comparison API requires admin auth", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/ci-builds/compare");
    expect(res.status()).toBe(401);
  });
});

test.describe("Notification Preferences Page", () => {
  test("notification prefs page loads for admin", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await navigateAndWait(page, "/admin/notification-prefs");

    // Page title
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    // Category rows visible
    await expect(page.getByText(/ci alerts/i).first()).toBeVisible();
    await expect(page.getByText(/search quality/i).first()).toBeVisible();
  });

  test("notification prefs shows enabled/disabled badges", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    await navigateAndWait(page, "/admin/notification-prefs");

    // Default: all enabled
    const enabledBadges = page.getByText(/enabled/i);
    const count = await enabledBadges.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("notification prefs API GET returns preferences", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/notification-prefs");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("preferences");
    expect(Array.isArray(body.preferences)).toBe(true);
    expect(body.preferences.length).toBe(8); // 4 categories x 2 channels
  });

  test("notification prefs API POST updates preference", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, seed);

    const res = await page.request.post("/api/admin/notification-prefs", {
      data: {
        category: "ci_alerts",
        channel: "email",
        enabled: false,
      },
    });
    expect(res.ok()).toBe(true);

    // Verify it persisted
    const getRes = await page.request.get("/api/admin/notification-prefs");
    const body = await getRes.json();
    const ciEmail = body.preferences.find(
      (p: { category: string; channel: string }) =>
        p.category === "ci_alerts" && p.channel === "email"
    );
    expect(ciEmail?.enabled).toBe(false);
  });

  test("notification prefs denied for non-admin", async ({ page }) => {
    const seed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, seed);

    const res = await page.request.get("/api/admin/notification-prefs");
    expect(res.status()).toBe(401);
  });
});
