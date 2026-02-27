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
 */
export async function seedTestData(
  request: APIRequestContext,
  options?: { role?: string }
): Promise<SeedData> {
  const res = await request.post("/api/test/seed", {
    data: { secret: E2E_TEST_SECRET, ...(options?.role ? { role: options.role } : {}) },
  });

  if (!res.ok()) {
    throw new Error(`Seed failed: ${res.status()} ${await res.text()}`);
  }

  return res.json();
}

/**
 * Login via the password auth API and store the session cookie.
 * Works with both Page and APIRequestContext.
 */
export async function loginAsTestUser(
  page: Page,
  seed: SeedData
): Promise<void> {
  // Login via API to get session cookie
  const res = await page.request.post("/api/auth/login-password", {
    data: { email: seed.email, password: seed.password },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login failed: ${res.status()} ${body}`);
  }

  // Navigate to trigger cookie setting in the browser context
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
}
