import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for smoke tests
 * Runs against live staging environment
 */
export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: "**/*.test.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  use: {
    baseURL: process.env.APP_URL || "http://idea.surmont.co/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
