import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let adminSeed: SeedData;

test.describe("Admin — Authenticated as admin", () => {
  test.beforeEach(async ({ page }) => {
    adminSeed = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, adminSeed);
  });

  test("admin page loads without redirecting to login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("analytics sub-page loads without redirecting to login", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("performance sub-page loads without redirecting to login", async ({ page }) => {
    await page.goto("/admin/performance");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("search-analytics sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/search-analytics");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("perf-dashboard sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/perf-dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("embeddings sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/embeddings");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("integrations sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/integrations");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("workflows sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/workflows");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("permissions sub-page loads for admin", async ({ page }) => {
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });
});

test.describe("Admin — Non-admin access denied", () => {
  let memberSeed: SeedData;

  test.beforeEach(async ({ page }) => {
    memberSeed = await seedTestData(page.request, { role: "member" });
    await loginAsTestUser(page, memberSeed);
  });

  test("member is not redirected to login on admin page", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("member is not redirected to login on analytics sub-page", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("member is not redirected to login on performance sub-page", async ({ page }) => {
    await page.goto("/admin/performance");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("member is not redirected to login on embeddings sub-page", async ({ page }) => {
    await page.goto("/admin/embeddings");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth/login");
  });
});

test.describe("Admin — Unauthenticated", () => {
  test("unauthenticated user is redirected to login from admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to login from admin analytics", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to login from admin performance", async ({ page }) => {
    await page.goto("/admin/performance");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to login from admin embeddings", async ({ page }) => {
    await page.goto("/admin/embeddings");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
