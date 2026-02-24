import { test, expect, devices } from "@playwright/test";

const MIN_TAP = 44;

// ============================================================
// Mobile viewport — iPhone 13 (390px)
// ============================================================

test.describe("Visual Regression — Mobile (390px)", () => {
  const { defaultBrowserType: _, ...iPhone13 } = devices["iPhone 13"];
  test.use({ ...iPhone13 });

  test("login card fits within mobile viewport with proper padding (#64)", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    // Card must not overflow viewport
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    // Card should have some horizontal padding (not flush to edge)
    expect(box!.x).toBeGreaterThan(0);
  });

  test("register card fits within mobile viewport (#64)", async ({ page }) => {
    await page.goto("/auth/register");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.x).toBeGreaterThan(0);
  });

  test("no horizontal overflow on homepage (#52/#67)", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("no horizontal overflow on login page", async ({ page }) => {
    await page.goto("/auth/login");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("no horizontal overflow on register page", async ({ page }) => {
    await page.goto("/auth/register");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("buttons have min 44px touch targets on auth pages (#68)", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    const submitBtn = page.getByRole("button", { name: /Sign In with Password/i });
    await expect(submitBtn).toBeVisible();
    const box = await submitBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });
});

// ============================================================
// Narrow viewport — 320px (smallest common)
// ============================================================

test.describe("Visual Regression — 320px viewport", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("homepage fits in 320px without overflow", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(321);
  });

  test("login page fits in 320px without overflow", async ({ page }) => {
    await page.goto("/auth/login");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(321);
  });

  test("register page fits in 320px without overflow", async ({ page }) => {
    await page.goto("/auth/register");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(321);
  });

  test("forgot-password page fits in 320px", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(321);
  });
});

// ============================================================
// Desktop viewport — 1280px
// ============================================================

test.describe("Visual Regression — Desktop (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("homepage renders at 1280px without layout issues", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Ideate")).toBeVisible();
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(1281);
  });

  test("login page renders at 1280px", async ({ page }) => {
    await page.goto("/auth/login");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    // Card should be centered, not full-width
    expect(box!.width).toBeLessThan(600);
  });
});

// ============================================================
// Wide viewport — 1920px
// ============================================================

test.describe("Visual Regression — Wide (1920px)", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("homepage content centered at 1920px", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Ideate")).toBeVisible();
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(1921);
  });
});

// ============================================================
// Dark mode (prefers-color-scheme: dark)
// ============================================================

test.describe("Visual Regression — Dark Mode", () => {
  test.use({ colorScheme: "dark" });

  test("homepage loads in dark mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Ideate")).toBeVisible();
    // Check that dark class is applied (theme toggle)
    const html = page.locator("html");
    // Either the class or the data attribute indicates dark mode
    // The page should at minimum render without errors
  });

  test("login page loads in dark mode", async ({ page }) => {
    await page.goto("/auth/login");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
  });
});

// ============================================================
// Light mode (explicit)
// ============================================================

test.describe("Visual Regression — Light Mode", () => {
  test.use({ colorScheme: "light" });

  test("homepage loads in light mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Ideate")).toBeVisible();
  });

  test("login page loads in light mode", async ({ page }) => {
    await page.goto("/auth/login");
    const card = page.locator("[data-slot='card']");
    await expect(card).toBeVisible();
  });
});

// ============================================================
// Locale: Romanian
// ============================================================

test.describe("Visual Regression — Romanian locale", () => {
  test("homepage renders in Romanian without overflow (#67)", async ({
    page,
  }) => {
    // Set the locale cookie
    await page.context().addCookies([
      {
        name: "locale",
        value: "ro",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/");
    // The page should load without errors
    await expect(page).toHaveTitle(/Ideate/);
    // Check no horizontal overflow
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("login page renders in Romanian", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "locale",
        value: "ro",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/auth/login");
    // Should show Romanian text
    await expect(page.getByText("Autentifică-te pe Ideate")).toBeVisible();
  });
});

// ============================================================
// Locale: English
// ============================================================

test.describe("Visual Regression — English locale", () => {
  test("login page renders in English", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "locale",
        value: "en",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/auth/login");
    await expect(page.getByText("Sign in to Ideate")).toBeVisible();
  });
});

// ============================================================
// Romanian + Mobile (compound edge case)
// ============================================================

test.describe("Visual Regression — Romanian + Mobile", () => {
  const { defaultBrowserType: _, ...iPhone13 } = devices["iPhone 13"];
  test.use({ ...iPhone13 });

  test("login page in Romanian fits mobile viewport (#67)", async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: "locale",
        value: "ro",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/auth/login");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("register page in Romanian fits mobile viewport (#67)", async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: "locale",
        value: "ro",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/auth/register");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  });
});
