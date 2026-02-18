import { test, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4100";
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET || "e2e-test-secret";
const SCREENSHOT_DIR = path.resolve("screenshots");

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

const LOCALES = ["en", "ro"] as const;
const THEMES = ["light", "dark"] as const;

type Locale = (typeof LOCALES)[number];
type Theme = (typeof THEMES)[number];
type Viewport = keyof typeof VIEWPORTS;

interface SeedData {
  email: string;
  password: string;
  userId: string;
  projectId: string;
  proposalId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
}

async function setLocale(context: BrowserContext, locale: Locale): Promise<void> {
  await context.addCookies([
    {
      name: "locale",
      value: locale,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, theme);
  await page.waitForTimeout(300);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Capture all locale x theme x viewport combinations for a given page state.
 *
 * For pages: navigates to `url`, waits for load, captures fullPage screenshots.
 * For dialogs: caller should already have the dialog open; captures viewport only.
 */
async function captureAllCombos(
  page: Page,
  name: string,
  options: {
    /** URL to navigate to before capturing. If null, assumes page is already in the right state. */
    url?: string | null;
    /** Whether to capture fullPage (true for pages, false for dialogs). Default: true */
    fullPage?: boolean;
    /** Run before each screenshot (e.g. open a dialog). Receives (page, locale, theme, viewport). */
    setup?: (page: Page, locale: Locale, theme: Theme, viewport: Viewport) => Promise<void>;
    /** Run after each screenshot (e.g. close a dialog). */
    teardown?: (page: Page, locale: Locale, theme: Theme, viewport: Viewport) => Promise<void>;
  } = {}
): Promise<void> {
  const { url, fullPage = true, setup, teardown } = options;
  const dir = path.join(SCREENSHOT_DIR, name);
  ensureDir(dir);

  for (const locale of LOCALES) {
    await setLocale(page.context(), locale);

    for (const theme of THEMES) {
      for (const vp of Object.keys(VIEWPORTS) as Viewport[]) {
        await page.setViewportSize(VIEWPORTS[vp]);

        if (url !== null && url !== undefined) {
          await page.goto(url);
          await page.waitForLoadState("networkidle");
        }

        await setTheme(page, theme);

        if (setup) {
          await setup(page, locale, theme, vp);
        }

        await page.waitForTimeout(400);

        const filename = `${locale}-${theme}-${vp}.png`;
        await page.screenshot({
          path: path.join(dir, filename),
          fullPage,
        });

        if (teardown) {
          await teardown(page, locale, theme, vp);
        }
      }
    }
  }
}

// ─── Test ───────────────────────────────────────────────────────────────────

test("capture all pages and dialogs", async ({ page }) => {
  test.setTimeout(600_000); // 10 minutes

  ensureDir(SCREENSHOT_DIR);
  const seed = await seedTestData(page);

  // ══════════════════════════════════════════════════════════════
  // SECTION 1: PUBLIC PAGES (no auth needed)
  // ══════════════════════════════════════════════════════════════

  console.log("📸 Capturing login page...");
  await captureAllCombos(page, "login", { url: "/auth/login" });

  console.log("📸 Capturing register page...");
  await captureAllCombos(page, "register", { url: "/auth/register" });

  console.log("📸 Capturing forgot-password page...");
  await captureAllCombos(page, "forgot-password", { url: "/auth/forgot-password" });

  console.log("📸 Capturing 404 page...");
  await captureAllCombos(page, "404", { url: "/nonexistent-page" });

  // ══════════════════════════════════════════════════════════════
  // SECTION 2: AUTHENTICATED PAGES
  // ══════════════════════════════════════════════════════════════

  await loginAsTestUser(page, seed);
  // Visit dashboard once to establish browser session cookies
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  console.log("📸 Capturing dashboard...");
  await captureAllCombos(page, "dashboard", { url: "/dashboard" });

  console.log("📸 Capturing projects list...");
  await captureAllCombos(page, "projects", { url: "/projects" });

  console.log("📸 Capturing project detail...");
  await captureAllCombos(page, "project-detail", {
    url: `/projects/${seed.projectId}`,
  });

  console.log("📸 Capturing new project form...");
  await captureAllCombos(page, "new-project", { url: "/projects/new" });

  console.log("📸 Capturing edit project...");
  await captureAllCombos(page, "edit-project", {
    url: `/projects/${seed.projectId}/edit`,
  });

  console.log("📸 Capturing profile page...");
  await captureAllCombos(page, "profile", { url: "/profile" });

  console.log("📸 Capturing admin panel...");
  await captureAllCombos(page, "admin", { url: "/admin" });

  // ══════════════════════════════════════════════════════════════
  // SECTION 3: DIALOGS / OVERLAYS
  // ══════════════════════════════════════════════════════════════

  console.log("📸 Capturing search dialog...");
  await captureAllCombos(page, "search-dialog", {
    url: "/dashboard",
    fullPage: false,
    setup: async (p) => {
      // Focus the search bar via Ctrl+K and type a query to open the dropdown
      await p.keyboard.press("Control+k");
      await p.waitForTimeout(200);
      const searchInput = p.locator('input[type="search"]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill("test");
        await p.waitForTimeout(800); // debounce + API call
      }
    },
    teardown: async (p) => {
      await p.keyboard.press("Escape");
      await p.waitForTimeout(200);
    },
  });

  console.log("📸 Capturing AI suggestions dialog...");
  await captureAllCombos(page, "ai-suggestions", {
    url: `/projects/${seed.projectId}`,
    fullPage: false,
    setup: async (p) => {
      const suggestBtn = p.getByRole("button", { name: /ai suggest/i });
      if (await suggestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await suggestBtn.click();
        await p.waitForTimeout(1000);
      }
    },
    teardown: async (p) => {
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
    },
  });

  console.log("📸 Capturing new proposal form...");
  await captureAllCombos(page, "new-proposal", {
    url: `/projects/${seed.projectId}`,
    fullPage: false,
    setup: async (p, _locale, _theme, vp) => {
      if (vp === "mobile") {
        // On mobile, the "New Proposal" button opens a dialog
        const newBtn = p.getByRole("button", { name: /new proposal/i });
        if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await newBtn.click();
          await p.waitForTimeout(500);
        }
      }
      // On desktop, the sidebar form is always visible — just capture
    },
    teardown: async (p, _locale, _theme, vp) => {
      if (vp === "mobile") {
        await p.keyboard.press("Escape");
        await p.waitForTimeout(300);
      }
    },
  });

  const totalScreenshots =
    14 * LOCALES.length * THEMES.length * Object.keys(VIEWPORTS).length;
  console.log(
    `\n✅ Screenshot capture complete: up to ${totalScreenshots} screenshots in ${SCREENSHOT_DIR}/\n`
  );
});
