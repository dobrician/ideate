import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const APP_URL = process.env.APP_URL || "https://idea.surmont.co";
const MAIL_LOG_FILE = process.env.MAIL_LOG_FILE || "/tmp/ideate-logs/mail.log";
const TEST_EMAIL = process.env.TEST_EMAIL || "smoketest@surcod.ro";

/**
 * Try to get the magic link URL from the mail log file.
 * Returns the full URL or null if not found within timeout.
 */
function getUrlFromMailLog(
  email: string,
  type: string,
  maxWaitMs = 10000
): string | null {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const content = readFileSync(MAIL_LOG_FILE, "utf-8");
      const lines = content.trim().split("\n").reverse();
      for (const line of lines) {
        if (!line) continue;
        const entry = JSON.parse(line);
        if (entry.to === email && entry.type === type) {
          return entry.url;
        }
      }
    } catch {
      // File may not exist yet
    }

    const waitUntil = Date.now() + pollInterval;
    while (Date.now() < waitUntil) {
      // busy-wait
    }
  }

  return null;
}

/**
 * Extract the latest magic link token from Gmail inbox (fallback).
 * Requires gog CLI with credentials configured.
 * All @surcod.ro emails forward to ciprian.dobrea@gmail.com via Cloudflare catch-all.
 */
function getLatestMagicLinkTokenFromGmail(email: string, maxWaitMs = 30000): string {
  const startTime = Date.now();
  const pollInterval = 3000;
  const seenTokens = new Set<string>();

  try {
    const output = execSync(
      `source /home/dc/.config/gogcli/gog.env && gog gmail search "from:idea@surcod.ro to:${email} newer_than:5m" --max 3 --json`,
      { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
    );
    const parsed = JSON.parse(output);
    if (parsed.threads) {
      for (const thread of parsed.threads) {
        try {
          const threadOutput = execSync(
            `source /home/dc/.config/gogcli/gog.env && gog gmail read ${thread.id}`,
            { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
          );
          const tokenMatches = threadOutput.matchAll(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g);
          for (const m of tokenMatches) seenTokens.add(m[1]);
        } catch { /* ignore */ }
      }
    }
  } catch { /* no existing emails, fine */ }

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const output = execSync(
        `source /home/dc/.config/gogcli/gog.env && gog gmail search "from:idea@surcod.ro to:${email} newer_than:5m" --max 3 --json`,
        { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
      );

      const parsed = JSON.parse(output);
      if (parsed.threads && parsed.threads.length > 0) {
        for (const thread of parsed.threads) {
          const threadOutput = execSync(
            `source /home/dc/.config/gogcli/gog.env && gog gmail read ${thread.id}`,
            { encoding: "utf-8", shell: "/bin/bash", timeout: 10000 }
          );

          const messages = threadOutput.split(/=== Message \d+\/\d+:/);
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.includes(`To: ${email}`) || msg.includes(`to: ${email}`)) {
              const tokenMatch = msg.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
              if (tokenMatch && !seenTokens.has(tokenMatch[1])) {
                return tokenMatch[1];
              }
            }
          }
        }
      }
    } catch {
      // Gmail search failed, retry
    }

    execSync(`sleep ${pollInterval / 1000}`);
  }

  throw new Error(`No magic link email found for ${email} within ${maxWaitMs}ms`);
}

test.describe("Smoke Tests - Full Auth Flow", () => {
  test("complete magic link authentication flow", async ({ page, request }) => {
    test.setTimeout(60000); // 60s for email polling
    // Step 1: Request magic link
    const requestResponse = await request.post(`${APP_URL}/auth/request`, {
      data: { email: TEST_EMAIL },
      headers: { "Content-Type": "application/json" },
    });
    expect(requestResponse.status()).toBe(200);
    const requestData = await requestResponse.json();
    expect(requestData.success).toBe(true);

    // Step 2: Get magic link URL from mail log, fall back to Gmail polling
    let verifyUrl: string;
    const logUrl = getUrlFromMailLog(TEST_EMAIL, "magic-link", 10000);
    if (logUrl) {
      verifyUrl = logUrl;
    } else {
      const token = getLatestMagicLinkTokenFromGmail(TEST_EMAIL);
      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(3);
      verifyUrl = `${APP_URL}/auth/verify?token=${token}`;
    }

    // Step 3: Click magic link (verify endpoint)
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

    // Step 7: Logout (POST request)
    const logoutResponse = await request.post(`${APP_URL}/auth/logout`, {
      headers: {
        Cookie: `session=${sessionCookie!.value}`,
        Accept: "application/json",
      },
    });
    expect(logoutResponse.status()).toBe(200);
    const logoutData = await logoutResponse.json();
    expect(logoutData.success).toBe(true);
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
