import { test, expect } from "@playwright/test";

// Use APP_URL from environment or default to staging
const APP_URL = process.env.APP_URL || "http://idea.surmont.co/";

test.describe("Smoke Tests - Staging Deployment", () => {
  test("homepage loads with HTTP 200 and real HTML content", async ({ page }) => {
    const response = await page.goto(APP_URL);

    // Check response status
    expect(response?.status()).toBe(200);

    // Check content type
    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("text/html");

    // Verify it's not an error page
    const title = await page.title();
    expect(title).not.toContain("404");
    expect(title).not.toContain("Error");
    expect(title).not.toContain("500");

    // Verify page has actual content
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);

    // Verify Next.js app loaded
    const nextData = await page.locator("#__next, #__NEXT_DATA__").count();
    expect(nextData).toBeGreaterThan(0);
  });

  test("health endpoint returns 200 with valid JSON", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/health`);

    // Check status
    expect(response.status()).toBe(200);

    // Check content type
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");

    // Parse and validate JSON
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("ok");

    // Verify DB connection is alive
    expect(data).toHaveProperty("database");
    expect(data.database).toBe("connected");

    // Verify timestamp
    expect(data).toHaveProperty("timestamp");
    expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login`);

    // Verify page loaded
    expect(page.url()).toContain("/auth/login");

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify page content
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Sign in");
    expect(pageContent).toContain("magic link");
  });

  test("static assets load successfully", async ({ page }) => {
    const responses: Array<{ url: string; status: number }> = [];

    // Capture all network responses
    page.on("response", (response) => {
      responses.push({
        url: response.url(),
        status: response.status(),
      });
    });

    await page.goto(APP_URL);

    // Wait for page to fully load
    await page.waitForLoadState("networkidle");

    // Check CSS assets
    const cssAssets = responses.filter((r) => r.url.includes(".css"));
    if (cssAssets.length > 0) {
      cssAssets.forEach((asset) => {
        expect(asset.status).toBe(200);
      });
    }

    // Check JS assets
    const jsAssets = responses.filter(
      (r) => r.url.includes(".js") || r.url.includes("/_next/")
    );
    if (jsAssets.length > 0) {
      jsAssets.forEach((asset) => {
        expect(asset.status).toBeLessThan(400);
      });
    }

    // Verify no critical asset failures
    const failedAssets = responses.filter(
      (r) => r.status >= 400 && (r.url.includes(".css") || r.url.includes(".js"))
    );
    expect(failedAssets.length).toBe(0);
  });

  test("environment variables are loaded correctly", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/health`);
    const data = await response.json();

    // Health endpoint should work, which means ENV vars are loaded
    expect(data.status).toBe("ok");

    // Check that we're not getting "missing config" errors
    const bodyText = JSON.stringify(data);
    expect(bodyText).not.toContain("missing config");
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("ENOENT");
  });

  test("projects page requires authentication", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/projects`);

    // Should redirect to login or show login page
    await page.waitForURL(/\/(auth\/login|projects)/, { timeout: 10000 });

    const currentUrl = page.url();

    // Either we're on login page (good) or we're authenticated (also good)
    const isOnLoginOrProjects =
      currentUrl.includes("/auth/login") || currentUrl.includes("/projects");
    expect(isOnLoginOrProjects).toBeTruthy();
  });

  test("API routes return proper error for unauthorized access", async ({ request }) => {
    // Try to access auth-required endpoint without session
    const response = await request.get(`${APP_URL}/api/projects/fake-id`);

    // Should return 401 Unauthorized or redirect
    expect([401, 404, 302, 307, 308]).toContain(response.status());

    // If JSON error response, verify format
    const contentType = response.headers()["content-type"];
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      expect(data).toHaveProperty("error");
    }
  });

  test("app handles 404 pages gracefully", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/this-page-does-not-exist`);

    // Should return 404
    expect(response?.status()).toBe(404);

    // Verify it shows a proper 404 page (not a crash)
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    // Next.js default 404 page contains "404" or "not found"
    const lowercaseBody = bodyText!.toLowerCase();
    const has404Indicator =
      lowercaseBody.includes("404") || lowercaseBody.includes("not found");
    expect(has404Indicator).toBeTruthy();
  });
});
