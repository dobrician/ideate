import { type Page, type APIRequestContext } from "@playwright/test";

const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET || "e2e-test-secret";

export interface SeedData {
  email: string;
  password: string;
  userId: string;
  projectId: string;
  proposalId: string;
}

/**
 * Seed a test user + project + proposal via the /api/test/seed endpoint.
 * Pass an optional role ("admin" | "member" | etc.) to control the user's role.
 *
 * Each call creates a fresh user with a unique email, providing natural
 * test isolation when running in parallel across multiple workers.
 */
export async function seedTestData(
  request: APIRequestContext,
  options?: { role?: string }
): Promise<SeedData> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await request.post("/api/test/seed", {
        data: {
          secret: E2E_TEST_SECRET,
          ...(options?.role ? { role: options.role } : {}),
        },
      });

      if (res.status() === 429) {
        // Rate limited — back off and retry
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      if (!res.ok()) {
        lastError = new Error(`Seed failed: ${res.status()} ${await res.text()}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw lastError;
      }

      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Seed failed after retries");
}

/**
 * Login via the password auth API and store the session cookie.
 * Includes retry logic for transient auth failures (rate limits, cold starts).
 */
export async function loginAsTestUser(
  page: Page,
  seed: SeedData
): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await page.request.post("/api/auth/login-password", {
        data: { email: seed.email, password: seed.password },
      });

      if (res.status() === 429) {
        // Rate limited — wait using retry-after header or back off
        const retryAfter = parseInt(res.headers()["retry-after"] ?? "2", 10);
        await page.waitForTimeout(retryAfter * 1000);
        continue;
      }

      if (!res.ok()) {
        const body = await res.text();
        lastError = new Error(`Login failed: ${res.status()} ${body}`);
        if (attempt < maxRetries) {
          await page.waitForTimeout(1000 * attempt);
          continue;
        }
        throw lastError;
      }

      // Navigate to trigger cookie setting in the browser context
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await page.waitForTimeout(1000 * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Login failed after retries");
}

/**
 * Wait for a page to be fully ready — content loaded and network idle.
 * Useful for server-rendered admin pages with slow data fetching.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  // networkidle may not resolve with SSE/WebSocket — use short timeout
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Navigate to a URL and wait for the page to be ready.
 * Combines goto + waitForPageReady for common E2E patterns.
 */
export async function navigateAndWait(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForPageReady(page);
}
