import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const APP_URL = process.env.APP_URL || "http://idea.surmont.co/";
const TEST_EMAIL = process.env.TEST_EMAIL || "smoketest@surcod.ro";

/**
 * Extract the latest magic link token from Gmail inbox.
 * Requires gog CLI with credentials configured.
 * All @surcod.ro emails forward to ciprian.dobrea@gmail.com via Cloudflare catch-all.
 */
function getLatestMagicLinkToken(email: string, maxWaitMs = 15000): string {
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

        // Read the thread and get the last message
        const threadOutput = execSync(
          `source /home/dc/.config/gogcli/gog.env && gog gmail read ${threadId}`,
          { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
        );

        // Find the last message sent to our test email
        const messages = threadOutput.split(/=== Message \d+\/\d+:/);
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.includes(`To: ${email}`) || msg.includes(`to: ${email}`)) {
            const tokenMatch = msg.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
            if (tokenMatch) {
              return tokenMatch[1];
            }
          }
        }
      }
    } catch {
      // Gmail search failed, retry
    }

    // Wait before polling again
    execSync(`sleep ${pollInterval / 1000}`);
  }

  throw new Error(`No magic link email found for ${email} within ${maxWaitMs}ms`);
}

test.describe("Smoke Tests - Full Auth Flow", () => {
  test("complete magic link authentication flow", async ({ page, request }) => {
    // Step 1: Request magic link
    const requestResponse = await request.post(`${APP_URL}/auth/request`, {
      data: { email: TEST_EMAIL },
      headers: { "Content-Type": "application/json" },
    });
    expect(requestResponse.status()).toBe(200);
    const requestData = await requestResponse.json();
    expect(requestData.success).toBe(true);

    // Step 2: Wait for email and extract token
    const token = getLatestMagicLinkToken(TEST_EMAIL);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3); // Valid JWT format

    // Step 3: Click magic link (verify endpoint)
    const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;
    await page.goto(verifyUrl);

    // Should redirect to homepage after successful auth
    await page.waitForURL((url) => !url.toString().includes("/auth/verify"), {
      timeout: 10000,
    });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/auth/verify");
    expect(currentUrl).not.toContain("error");

    // Step 4: Verify we're authenticated - should see navigation elements
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    // Step 5: Access protected page (projects)
    await page.goto(`${APP_URL}/projects`);
    await page.waitForLoadState("networkidle");

    // Should NOT redirect to login (we're authenticated)
    const projectsUrl = page.url();
    expect(projectsUrl).not.toContain("/auth/login");

    // Step 6: Verify /api/me returns our user
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeTruthy();

    const meResponse = await request.get(`${APP_URL}/api/me`, {
      headers: {
        Cookie: `session=${sessionCookie!.value}`,
      },
    });
    expect(meResponse.status()).toBe(200);
    const meData = await meResponse.json();
    expect(meData.email).toBe(TEST_EMAIL);

    // Step 7: Logout
    await page.goto(`${APP_URL}/auth/logout`);
    await page.waitForURL(/\/(auth\/login|$)/, { timeout: 10000 });
  });

  test("expired/invalid token shows error gracefully", async ({ page }) => {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ0eXBlIjoibWFnaWMtbGluayIsImlhdCI6MTAwMDAwMDAwMCwiZXhwIjoxMDAwMDAwMDAxfQ.invalid";

    await page.goto(`${APP_URL}/auth/verify?token=${fakeToken}`);

    // Should redirect to login with error
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain("/auth/login");
  });

  test("missing token redirects to login", async ({ page }) => {
    await page.goto(`${APP_URL}/auth/verify`);

    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/auth/login");
  });
});
