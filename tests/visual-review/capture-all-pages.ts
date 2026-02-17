import { test, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4100";
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET || "e2e-test-secret";
const SCREENSHOT_DIR = "tests/visual-review/screenshots";

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

interface SeedData {
  email: string;
  password: string;
  userId: string;
  projectId: string;
  proposalId: string;
}

async function seedTestData(page: Page): Promise<SeedData> {
  const res = await page.request.post(`${BASE_URL}/api/test/seed`, {
    data: { secret: E2E_TEST_SECRET },
  });
  if (!res.ok()) {
    throw new Error(`Seed failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

async function loginAsTestUser(page: Page, seed: SeedData): Promise<void> {
  const res = await page.request.post(`${BASE_URL}/api/auth/login-password`, {
    data: { email: seed.email, password: seed.password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, theme);
  // Give CSS transitions time to settle
  await page.waitForTimeout(300);
}

async function screenshot(
  page: Page,
  name: string,
  opts?: { fullPage?: boolean }
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500); // let animations/transitions finish
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: opts?.fullPage ?? true,
  });
}

async function withViewport(
  page: Page,
  viewport: { width: number; height: number },
  fn: () => Promise<void>
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(200);
  await fn();
}

// ─── Single serial test that captures every page ───────────────────────

test("capture all pages for visual review", async ({ page }) => {
  test.setTimeout(600_000); // 10 minutes — lots of screenshots

  const seed = await seedTestData(page);
  let counter = 1;
  const num = () => String(counter++).padStart(2, "0");

  // ════════════════════════════════════════════════════════
  // SECTION 1: LOGGED-OUT PAGES (light mode)
  // ════════════════════════════════════════════════════════

  // --- Home page (logged out) ---
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-home-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-home-desktop-light`);
  });

  // --- Home page dark mode ---
  await setTheme(page, "dark");
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-home-mobile-dark`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-home-desktop-dark`);
  });

  // --- Login page (empty) ---
  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-login-empty-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-login-empty-desktop-light`);
  });

  // --- Login page with validation errors ---
  await setTheme(page, "light");
  await withViewport(page, DESKTOP, async () => {
    // Submit with empty fields to trigger validation
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, `${num()}-login-validation-desktop-light`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-login-validation-mobile-light`);
  });

  // --- Login page dark mode ---
  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-login-desktop-dark`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-login-mobile-dark`);
  });

  // --- Register page (empty) ---
  await page.goto("/auth/register");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-register-empty-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-register-empty-desktop-light`);
  });

  // --- Register page with validation errors ---
  await withViewport(page, DESKTOP, async () => {
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, `${num()}-register-validation-desktop-light`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-register-validation-mobile-light`);
  });

  // --- Forgot password page ---
  await page.goto("/auth/forgot-password");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-forgot-password-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-forgot-password-desktop-light`);
  });

  // --- 404 page ---
  await page.goto("/this-page-does-not-exist-404");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-404-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-404-desktop-light`);
  });

  // ════════════════════════════════════════════════════════
  // SECTION 2: LOGGED-IN PAGES
  // ════════════════════════════════════════════════════════

  await loginAsTestUser(page, seed);

  // --- Dashboard (light) ---
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-dashboard-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-dashboard-desktop-light`);
  });

  // --- Dashboard (dark) ---
  await setTheme(page, "dark");
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-dashboard-mobile-dark`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-dashboard-desktop-dark`);
  });

  // --- Projects list (light) ---
  await page.goto("/projects");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-projects-list-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-projects-list-desktop-light`);
  });

  // --- Projects list (dark) ---
  await setTheme(page, "dark");
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-projects-list-desktop-dark`);
  });

  // --- Create project form ---
  await page.goto("/projects/new");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-create-project-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-create-project-desktop-light`);
  });

  // --- Create project form with validation errors ---
  await withViewport(page, DESKTOP, async () => {
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, `${num()}-create-project-validation-desktop-light`);
  });

  // --- Project detail page (light) ---
  await page.goto(`/projects/${seed.projectId}`);
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-project-detail-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-project-detail-desktop-light`);
  });

  // --- Project detail page (dark) ---
  await setTheme(page, "dark");
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-project-detail-mobile-dark`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-project-detail-desktop-dark`);
  });

  // --- Proposal expanded (accordion) ---
  await setTheme(page, "light");
  await withViewport(page, DESKTOP, async () => {
    // Try to expand the first proposal accordion item
    const trigger = page.locator('[data-slot="accordion-trigger"]').first();
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.waitForTimeout(400);
    }
    await screenshot(page, `${num()}-proposal-expanded-desktop-light`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-proposal-expanded-mobile-light`);
  });

  // --- AI Suggestions modal ---
  await setTheme(page, "light");
  await withViewport(page, DESKTOP, async () => {
    const suggestBtn = page.getByRole("button", { name: /suggest|ai/i });
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();
      await page.waitForTimeout(1000); // wait for modal + potential API call
      await screenshot(page, `${num()}-ai-suggestions-modal-desktop-light`, { fullPage: false });
      // Close the dialog
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  });
  await withViewport(page, MOBILE, async () => {
    const suggestBtn = page.getByRole("button", { name: /suggest|ai/i });
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, `${num()}-ai-suggestions-modal-mobile-light`, { fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  });

  // --- New Proposal form (mobile dialog) ---
  await setTheme(page, "light");
  await withViewport(page, MOBILE, async () => {
    const newProposalBtn = page.getByRole("button", { name: /new proposal/i });
    if (await newProposalBtn.isVisible()) {
      await newProposalBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, `${num()}-new-proposal-dialog-mobile-light`, { fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  });

  // --- Desktop sidebar proposal form ---
  await withViewport(page, DESKTOP, async () => {
    // The sidebar form is visible on desktop at lg breakpoint
    await screenshot(page, `${num()}-proposal-sidebar-form-desktop-light`);
  });

  // --- Comment/discussion section ---
  await setTheme(page, "light");
  await withViewport(page, DESKTOP, async () => {
    // Scroll to the comments section at the bottom
    const commentSection = page.getByRole("heading", { name: /discussion/i }).first();
    if (await commentSection.isVisible()) {
      await commentSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await screenshot(page, `${num()}-comments-section-desktop-light`);
  });

  // --- Discussion sheet (per-proposal comments) ---
  await withViewport(page, DESKTOP, async () => {
    // The discussion sheet is triggered by a button with a MessageSquare icon
    // Look for buttons inside accordion content that could open the sheet
    const sheetTrigger = page.locator('[data-slot="accordion-content"] button').first();
    if (await sheetTrigger.isVisible()) {
      await sheetTrigger.click();
      await page.waitForTimeout(500);
      // Check if a sheet opened
      const sheet = page.locator('[data-slot="sheet-content"]');
      if (await sheet.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, `${num()}-discussion-sheet-desktop-light`, { fullPage: false });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }
  });

  // --- Profile page ---
  await page.goto("/profile");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-profile-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-profile-desktop-light`);
  });

  // --- Change password section (scroll into view) ---
  await withViewport(page, DESKTOP, async () => {
    const changePw = page.getByRole("heading", { name: /change password/i }).first();
    if (await changePw.isVisible()) {
      await changePw.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await screenshot(page, `${num()}-change-password-desktop-light`);
  });
  await withViewport(page, MOBILE, async () => {
    const changePw = page.getByRole("heading", { name: /change password/i }).first();
    if (await changePw.isVisible()) {
      await changePw.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await screenshot(page, `${num()}-change-password-mobile-light`);
  });

  // --- Admin panel ---
  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "light");

  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-admin-mobile-light`);
  });
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-admin-desktop-light`);
  });

  // --- Admin panel dark mode ---
  await setTheme(page, "dark");
  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-admin-desktop-dark`);
  });

  // --- Admin panel with search/filter ---
  await setTheme(page, "light");
  await withViewport(page, DESKTOP, async () => {
    const searchInput = page.getByPlaceholder(/search|filter/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("e2e");
      await page.waitForTimeout(500);
      await screenshot(page, `${num()}-admin-search-desktop-light`);
      await searchInput.clear();
    } else {
      // Take screenshot of admin as-is
      await screenshot(page, `${num()}-admin-no-search-desktop-light`);
    }
  });

  // ════════════════════════════════════════════════════════
  // SECTION 3: ADDITIONAL DARK MODE CAPTURES
  // ════════════════════════════════════════════════════════

  // --- Profile dark mode ---
  await page.goto("/profile");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");

  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-profile-desktop-dark`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-profile-mobile-dark`);
  });

  // --- Create project dark mode ---
  await page.goto("/projects/new");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");

  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-create-project-desktop-dark`);
  });

  // --- Forgot password dark mode ---
  // (need to log out first or just navigate — since the home page redirects when logged in,
  //  we can still access /auth/forgot-password directly as it's a public route)
  await page.goto("/auth/forgot-password");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");

  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-forgot-password-desktop-dark`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-forgot-password-mobile-dark`);
  });

  // --- Register dark mode ---
  await page.goto("/auth/register");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");

  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-register-desktop-dark`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-register-mobile-dark`);
  });

  // --- 404 dark mode ---
  await page.goto("/this-page-does-not-exist-404");
  await page.waitForLoadState("domcontentloaded");
  await setTheme(page, "dark");

  await withViewport(page, DESKTOP, async () => {
    await screenshot(page, `${num()}-404-desktop-dark`);
  });
  await withViewport(page, MOBILE, async () => {
    await screenshot(page, `${num()}-404-mobile-dark`);
  });

  console.log(`\n✅ Visual review complete: ${counter - 1} screenshots captured in ${SCREENSHOT_DIR}/\n`);
});
