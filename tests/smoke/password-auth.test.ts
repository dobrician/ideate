import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "fs";

const APP_URL = process.env.APP_URL || "https://idea.surmont.co";
const ORIGIN = new URL(APP_URL).origin;
const MAIL_LOG_FILE =
  process.env.MAIL_LOG_FILE || "/tmp/ideate-mail.log";
const TEST_EMAIL_PREFIX = `smokepass${Date.now()}`;
const TEST_EMAIL = `${TEST_EMAIL_PREFIX}@surcod.ro`;
const TEST_PASSWORD = "SmokeTest123";

/**
 * Extract a URL from the mail log file for the given email and type.
 * Uses async polling with setTimeout instead of busy-wait to avoid
 * blocking the event loop and causing Playwright timeouts.
 */
async function getUrlFromMailLog(
  email: string,
  type: string,
  maxWaitMs = 30000
): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (existsSync(MAIL_LOG_FILE)) {
        const content = readFileSync(MAIL_LOG_FILE, "utf-8");
        const lines = content.trim().split("\n").reverse();
        for (const line of lines) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.to === email && entry.type === type) {
              return entry.url;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch {
      // File may not exist yet, keep polling
    }

    // Async sleep instead of busy-wait
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `No ${type} mail log entry found for ${email} within ${maxWaitMs}ms (file: ${MAIL_LOG_FILE})`
  );
}

test.describe("Smoke Tests - Password Auth Flow", () => {
  test("register page loads and shows form", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/register`);
    await page.waitForLoadState("networkidle");

    const heading = await page.textContent("[data-slot='card-title']");
    expect(heading).toContain("Create");

    // Should have email, password, confirm fields
    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = page.locator('input[type="password"]');
    expect(await emailInput.count()).toBeGreaterThanOrEqual(1);
    expect(await passwordInputs.count()).toBeGreaterThanOrEqual(2);
  });

  test("login page shows dual auth (password + magic link toggle)", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/auth/login`);
    await page.waitForLoadState("networkidle");

    // Default should be password mode
    const passwordInput = page.locator('input[type="password"]');
    expect(await passwordInput.count()).toBeGreaterThanOrEqual(1);

    // Should have "Sign in with Magic Link" toggle
    const magicLinkBtn = page.locator("text=Magic Link");
    expect(await magicLinkBtn.count()).toBeGreaterThanOrEqual(1);
  });

  test("forgot-password page loads", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/forgot-password`);
    await page.waitForLoadState("networkidle");

    const heading = await page.textContent("[data-slot='card-title']");
    expect(heading).toMatch(/Reset|Forgot/);

    const emailInput = page.locator('input[type="email"]');
    expect(await emailInput.count()).toBeGreaterThanOrEqual(1);
  });

  test("reset-password page shows invalid link without token", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/auth/reset-password`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Invalid");
  });

  test("registration with weak password returns error", async ({
    request,
  }) => {
    const response = await request.post(`${APP_URL}/api/auth/register`, {
      data: {
        email: "weakpass@example.com",
        password: "short",
        confirmPassword: "short",
      },
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  test("login with non-existent user returns error", async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/auth/login-password`, {
      data: {
        email: "nonexistent@example.com",
        password: "Password123",
      },
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    });
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("Invalid");
  });

  test("forgot-password for non-existent email returns success (anti-enum)", async ({
    request,
  }) => {
    const response = await request.post(`${APP_URL}/api/auth/forgot-password`, {
      data: { email: "nobody@example.com" },
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("reset-password with invalid token returns error", async ({
    request,
  }) => {
    const response = await request.post(`${APP_URL}/api/auth/reset-password`, {
      data: {
        token: "invalid-token",
        password: "NewPassword123",
        confirmPassword: "NewPassword123",
      },
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    });
    expect(response.status()).toBe(400);
  });

  test("full register -> verify -> login flow via API", async ({
    request,
  }) => {
    test.setTimeout(90000);

    // Step 1: Register
    const regResponse = await request.post(`${APP_URL}/api/auth/register`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      },
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    });
    expect(regResponse.status()).toBe(200);
    const regData = await regResponse.json();
    expect(regData.success).toBe(true);

    // Step 2: Login before verification should fail
    const preLoginResponse = await request.post(
      `${APP_URL}/api/auth/login-password`,
      {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
      }
    );
    expect(preLoginResponse.status()).toBe(403);
    const preLoginData = await preLoginResponse.json();
    expect(preLoginData.code).toBe("EMAIL_NOT_VERIFIED");

    // Step 3: Get verification URL from mail log (30s timeout with async polling)
    const verifyUrl = await getUrlFromMailLog(
      TEST_EMAIL,
      "verification",
      30000
    );
    expect(verifyUrl).toBeTruthy();

    // Step 4: Verify email
    const verifyResponse = await request.get(verifyUrl, {
      maxRedirects: 0,
    });
    expect([200, 302, 307, 308]).toContain(verifyResponse.status());

    // Step 5: Login with password after verification
    const loginResponse = await request.post(
      `${APP_URL}/api/auth/login-password`,
      {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
      }
    );
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
  });
});
