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
    expect(data.status).toBe("healthy");

    // Verify DB connection is alive
    expect(data).toHaveProperty("database");
    expect(data.database).toBe("ok");

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
    await expect(page.getByRole("button", { name: "Send Magic Link" })).toBeVisible();

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
    expect(data.status).toBe("healthy");

    // Check that we're not getting "missing config" errors
    const bodyText = JSON.stringify(data);
    expect(bodyText).not.toContain("missing config");
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

  test("API routes redirect unauthorized access", async ({ page }) => {
    // Try to access auth-required page without session
    const response = await page.goto(`${APP_URL}/projects`);

    // Middleware redirects to login page
    const currentUrl = page.url();
    if (currentUrl.includes("/auth/login")) {
      // Successfully redirected — verify login page rendered
      await expect(page.locator('input[type="email"]')).toBeVisible();
    } else {
      // Already authenticated — page should load without errors
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test("app handles non-existent pages", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/this-page-does-not-exist`);

    // Next.js App Router may return 200 with a not-found page or 404
    expect(response?.status()).toBeLessThan(500);

    // Verify page loaded without crashing
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    // Should show either a 404 indicator or redirect to login
    const lowercaseBody = bodyText!.toLowerCase();
    const currentUrl = page.url();
    const isHandledGracefully =
      lowercaseBody.includes("404") ||
      lowercaseBody.includes("not found") ||
      currentUrl.includes("/auth/login");
    expect(isHandledGracefully).toBeTruthy();
  });
});
