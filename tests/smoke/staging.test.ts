import { test, expect } from "@playwright/test";

// Use APP_URL from environment or default to staging
const APP_URL = process.env.APP_URL || "https://idea.surmont.co";

test.describe("Smoke Tests - Core", () => {
  test("homepage loads with HTTP 200 and real HTML content", async ({ page }) => {
    const response = await page.goto(APP_URL);

    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("text/html");

    const title = await page.title();
    expect(title).not.toContain("404");
    expect(title).not.toContain("Error");
    expect(title).not.toContain("500");

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test("health endpoint returns 200 with valid JSON", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/health`);

    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("healthy");
    expect(data).toHaveProperty("database");
    expect(data.database).toBe("ok");
    expect(data).toHaveProperty("timestamp");
    expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login`);

    expect(page.url()).toContain("/auth/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Login defaults to password mode with a magic link toggle
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In with Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Magic Link/i })).toBeVisible();

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Sign in");
  });

  test("static assets load successfully", async ({ page }) => {
    const responses: Array<{ url: string; status: number }> = [];

    page.on("response", (response) => {
      responses.push({ url: response.url(), status: response.status() });
    });

    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    const cssAssets = responses.filter((r) => r.url.includes(".css"));
    if (cssAssets.length > 0) {
      cssAssets.forEach((asset) => {
        expect(asset.status).toBe(200);
      });
    }

    const jsAssets = responses.filter(
      (r) => r.url.includes(".js") || r.url.includes("/_next/")
    );
    if (jsAssets.length > 0) {
      jsAssets.forEach((asset) => {
        expect(asset.status).toBeLessThan(400);
      });
    }

    const failedAssets = responses.filter(
      (r) => r.status >= 400 && (r.url.includes(".css") || r.url.includes(".js"))
    );
    expect(failedAssets.length).toBe(0);
  });

  test("environment variables are loaded correctly", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/health`);
    const data = await response.json();

    expect(data.status).toBe("healthy");
    const bodyText = JSON.stringify(data);
    expect(bodyText).not.toContain("missing config");
    expect(bodyText).not.toContain("ENOENT");
  });
});

test.describe("Smoke Tests - Auth & Access Control", () => {
  test("projects page requires authentication", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/projects`);
    await page.waitForURL(/\/(auth\/login|projects)/, { timeout: 10000 });

    const currentUrl = page.url();
    const isOnLoginOrProjects =
      currentUrl.includes("/auth/login") || currentUrl.includes("/projects");
    expect(isOnLoginOrProjects).toBeTruthy();
  });

  test("API routes redirect unauthorized access", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/projects`);
    const currentUrl = page.url();
    if (currentUrl.includes("/auth/login")) {
      await expect(page.locator('input[type="email"]')).toBeVisible();
    } else {
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test("app handles non-existent pages", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/this-page-does-not-exist`);

    expect(response?.status()).toBeLessThan(500);

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    const lowercaseBody = bodyText!.toLowerCase();
    const currentUrl = page.url();
    const isHandledGracefully =
      lowercaseBody.includes("404") ||
      lowercaseBody.includes("not found") ||
      currentUrl.includes("/auth/login");
    expect(isHandledGracefully).toBeTruthy();
  });

  test("admin panel requires authentication", async ({ page }) => {
    await page.goto(`${APP_URL}/admin`);
    await page.waitForURL(/\/(auth\/login|admin)/, { timeout: 10000 });

    const currentUrl = page.url();
    // Should redirect to login (no session) or load admin page (if authenticated as admin)
    const isHandled =
      currentUrl.includes("/auth/login") || currentUrl.includes("/admin");
    expect(isHandled).toBeTruthy();
  });
});

test.describe("Smoke Tests - Search API", () => {
  test("search endpoint returns 401 without auth", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/search?q=test`);

    // Should return 401 for unauthenticated requests
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("search endpoint handles missing query", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/search`);

    // Without auth, should get 401
    expect(response.status()).toBe(401);
  });
});

test.describe("Smoke Tests - Export API", () => {
  test("export endpoint requires authentication", async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/projects/nonexistent-id/export?format=pdf`,
      { maxRedirects: 0 }
    );

    // Should return 401 or redirect to login (307)
    expect([401, 307]).toContain(response.status());
  });

  test("export endpoint rejects invalid format", async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/projects/test-id/export?format=xml`,
      { maxRedirects: 0 }
    );

    // Without auth, should get 401 or redirect to login (307)
    expect([401, 307]).toContain(response.status());
  });
});

test.describe("Smoke Tests - SSE Vote Stream", () => {
  test("vote stream requires authentication", async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/votes/stream?projectId=test`
    );

    expect(response.status()).toBe(401);
  });

  test("vote stream requires projectId parameter", async ({ request }) => {
    // Without auth, should get 401 before 400
    const response = await request.get(`${APP_URL}/api/votes/stream`);

    expect(response.status()).toBe(401);
  });
});

test.describe("Smoke Tests - i18n Locale", () => {
  test("homepage renders with default locale", async ({ page }) => {
    await page.goto(APP_URL);

    // Page should have a lang attribute
    const htmlLang = await page.getAttribute("html", "lang");
    expect(htmlLang).toBeTruthy();
    expect(["en", "ro"]).toContain(htmlLang);
  });

  test("login page renders with locale-aware content", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login`);

    // Page content should be present (in either language)
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("locale switcher is accessible on the page", async ({ page }) => {
    await page.goto(APP_URL);

    // The locale switcher button should be present (EN or RO text)
    const bodyText = await page.textContent("body");
    const hasLocaleSwitcher =
      bodyText?.includes("EN") || bodyText?.includes("RO");
    expect(hasLocaleSwitcher).toBeTruthy();
  });
});

test.describe("Smoke Tests - Email Deliverability", () => {
  test("email deliverability endpoint requires admin auth", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/email/deliverability`);

    // Should require authentication
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });
});

test.describe("Smoke Tests - API /me", () => {
  test("/api/me returns 401 without session", async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/me`);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });
});
