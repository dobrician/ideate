/** Permit test fixtures only with explicit opt-in and a loopback application origin. */
export function getE2EConfig(): { secret: string; origin: URL } | null {
  if (process.env.E2E_TEST_ENABLED !== "true" || !process.env.E2E_TEST_SECRET) return null;
  try {
    const origin = new URL(process.env.APP_URL || "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) return null;
    return { secret: process.env.E2E_TEST_SECRET, origin };
  } catch {
    return null;
  }
}
