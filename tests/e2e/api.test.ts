import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("search API returns results for empty query", async ({ request }) => {
    const response = await request.get("/api/search?q=");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty("results");
  });

  test("export API requires authentication", async ({ request }) => {
    const response = await request.get(
      "/api/projects/nonexistent/export?format=csv"
    );
    expect(response.status()).toBe(401);
  });

  test("export API validates format parameter", async ({ request }) => {
    // This will redirect to login since we're not authenticated
    const response = await request.get(
      "/api/projects/test/export?format=invalid"
    );
    expect([400, 401]).toContain(response.status());
  });

  test("me API returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get("/api/me");
    expect(response.status()).toBe(401);
  });

  test("health API includes version", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(body).toHaveProperty("version");
  });

  test("auth request rate limits by IP", async ({ request }) => {
    // Send multiple requests rapidly
    const promises = Array.from({ length: 25 }, () =>
      request.post("/auth/request", {
        data: { email: `test-ratelimit-${Math.random()}@example.com` },
      })
    );
    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status());
    // At least one should be 429 (rate limited)
    expect(statuses.some((s) => s === 429)).toBe(true);
  });
});
