import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4100";
const E2E_TEST_SECRET = "e2e-test-secret";
const SCREENSHOT_DIR = path.resolve("screenshots");

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const LOCALES = ["en", "ro"] as const;
const THEMES = ["light", "dark"] as const;

async function run() {
  const browser = await chromium.launch();

  // Seed
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const seedRes = await page.request.post(`${BASE_URL}/api/test/seed`, {
    data: { secret: E2E_TEST_SECRET },
  });
  const seed = await seedRes.json();
  console.log("Seeded:", seed.email);

  // Login
  await page.request.post(`${BASE_URL}/api/auth/login-password`, {
    data: { email: seed.email, password: seed.password },
  });

  const pages: [string, string, boolean][] = [
    // ["new-project", "/projects/new", true], // already captured
    ["edit-project", `/projects/${seed.projectId}/edit`, true],
    ["profile", "/profile", true],
    ["admin", "/admin", true],
  ];

  for (const [name, url, needsAuth] of pages) {
    console.log(`📸 Capturing ${name}...`);
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
          const dir = path.join(SCREENSHOT_DIR, name);
          fs.mkdirSync(dir, { recursive: true });
          const fname = `${locale}-${theme}-${vpName}.png`;

          await page.setViewportSize(vp);
          await ctx.addCookies([{ name: "locale", value: locale, url: BASE_URL }]);
          await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForTimeout(1500);

          if (theme === "dark") {
            await page.evaluate(() => document.documentElement.classList.add("dark"));
          } else {
            await page.evaluate(() => document.documentElement.classList.remove("dark"));
          }
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(dir, fname), fullPage: true });
          console.log(`  ✅ ${fname}`);
        }
      }
    }
  }

  // Dialogs: search, ai-suggestions, new-proposal
  const dialogs: [string, () => Promise<void>][] = [
    ["search-dialog", async () => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(500);
    }],
    ["new-proposal-dialog", async () => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/projects/${seed.projectId}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1500);
      const btn = page.locator("button", { hasText: /New|\+ New/ });
      if (await btn.isVisible()) await btn.click();
      await page.waitForTimeout(500);
    }],
  ];

  for (const [name, setup] of dialogs) {
    console.log(`📸 Capturing ${name}...`);
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const dir = path.join(SCREENSHOT_DIR, name);
        fs.mkdirSync(dir, { recursive: true });

        await ctx.addCookies([{ name: "locale", value: locale, url: BASE_URL }]);
        await setup();

        if (theme === "dark") {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        } else {
          await page.evaluate(() => document.documentElement.classList.remove("dark"));
        }
        await page.waitForTimeout(300);

        // Desktop + mobile for dialogs
        for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
          await page.setViewportSize(vp);
          await page.waitForTimeout(200);
          const fname = `${locale}-${theme}-${vpName}.png`;
          await page.screenshot({ path: path.join(dir, fname) });
          console.log(`  ✅ ${fname}`);
        }

        // Close dialog
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }
  }

  await browser.close();
  const total = fs.readdirSync(SCREENSHOT_DIR, { recursive: true }).filter((f) => String(f).endsWith(".png")).length;
  console.log(`\n✅ Total screenshots: ${total}`);
}

run().catch(console.error);
