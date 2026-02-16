import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const APP_URL = process.env.APP_URL || "https://idea.surmont.co";
const TEST_EMAIL_PREFIX = `smokepass${Date.now()}`;
const TEST_EMAIL = `${TEST_EMAIL_PREFIX}@surcod.ro`;
const TEST_PASSWORD = "SmokeTest123";

/**
 * Extract verification/reset token from email via Gmail API.
 * Polls Gmail for up to maxWaitMs looking for a link with the given path.
 */
function getTokenFromEmail(
  email: string,
  linkPath: string,
  maxWaitMs = 20000
): string {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const output = execSync(
        `source /home/dc/.config/gogcli/gog.env && gog gmail search "from:idea@surcod.ro to:${email} newer_than:2m" --max 1 --json`,
        { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
      );

      const parsed = JSON.parse(output);
      if (parsed.threads && parsed.threads.length > 0) {
        const threadId = parsed.threads[0].id;
        const threadOutput = execSync(
          `source /home/dc/.config/gogcli/gog.env && gog gmail read ${threadId}`,
          { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
        );

        // Find token= parameter in the email matching linkPath
        const tokenRegex = new RegExp(
          `${linkPath.replace("/", "\\/")}\\?token=([a-f0-9]+)`
        );
        const match = threadOutput.match(tokenRegex);
        if (match) {
          return match[1];
        }
      }
    } catch {
      // Search failed, retry
    }

    execSync(`sleep ${pollInterval / 1000}`);
  }

  throw new Error(
    `No ${linkPath} email found for ${email} within ${maxWaitMs}ms`
  );
}

test.describe("Smoke Tests - Password Auth Flow", () => {
  test("register page loads and shows form", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/register`);
    await page.waitForLoadState("networkidle");

    const heading = await page.textContent("h2, [class*='CardTitle']");
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

    const heading = await page.textContent("h2, [class*='CardTitle']");
    expect(heading).toContain("Reset");

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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("full register -> verify -> login flow via API", async ({
    request,
  }) => {
    test.setTimeout(60000);

    // Step 1: Register
    const regResponse = await request.post(`${APP_URL}/api/auth/register`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(regResponse.status()).toBe(200);
    const regData = await regResponse.json();
    expect(regData.success).toBe(true);

    // Step 2: Login before verification should fail
    const preLoginResponse = await request.post(
      `${APP_URL}/api/auth/login-password`,
      {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(preLoginResponse.status()).toBe(403);
    const preLoginData = await preLoginResponse.json();
    expect(preLoginData.code).toBe("EMAIL_NOT_VERIFIED");

    // Step 3: Get verification token from email
    const verifyToken = getTokenFromEmail(
      TEST_EMAIL,
      "/auth/verify-email"
    );
    expect(verifyToken).toBeTruthy();

    // Step 4: Verify email
    const verifyResponse = await request.get(
      `${APP_URL}/auth/verify-email?token=${verifyToken}`,
      { maxRedirects: 0 }
    );
    expect([200, 302, 307, 308]).toContain(verifyResponse.status());

    // Step 5: Login with password after verification
    const loginResponse = await request.post(
      `${APP_URL}/api/auth/login-password`,
      {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
  });
});
