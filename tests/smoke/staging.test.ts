import { test, expect } from "@playwright/test";

// Use APP_URL from environment or default to staging
const APP_URL = process.env.APP_URL || "https://ideate.surcod.ro";

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

  test("SSO retry has no local credentials form", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login?error=oidc_error`);
    await expect(page.getByRole("link", { name: /SSO/ })).toBeVisible();
    await expect(page.locator("form, input")).toHaveCount(0);
  });

  test("static assets load successfully", async ({ page }) => {
    await page.goto(APP_URL);
    const assets = await page.locator('link[rel="stylesheet"], script[src]').evaluateAll(
      elements => elements.map(element => element.getAttribute("href") || element.getAttribute("src")).filter(Boolean)
    );
    expect(assets.some(url => url!.includes(".css"))).toBe(true);
    expect(assets.some(url => url!.includes(".js"))).toBe(true);
    for (const asset of assets) {
      const response = await page.request.get(new URL(asset!, APP_URL).href);
      expect(response.status()).toBe(200);
    }
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
  for (const path of ["/projects", "/admin"]) {
    test(`${path} requires authentication`, async ({ request }) => {
      const response = await request.get(`${APP_URL}${path}`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const destination = new URL(response.headers().location, APP_URL);
      expect(destination.pathname).toBe("/auth/login");
      expect(destination.searchParams.get("redirect")).toBe(path);
    });
  }
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
    await page.goto(`${APP_URL}/auth/login?error=oidc_error`);

    // Page content should be present (in either language)
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("locale switcher is accessible on the page", async ({ page }) => {
    await page.goto(APP_URL);

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Switch to Romanian|Switch to English/ })).toBeVisible();
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
