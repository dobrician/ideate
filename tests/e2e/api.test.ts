import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("search API requires authentication", async ({ request }) => {
    // /api/search is public in proxy but requires auth in the route handler
    const response = await request.get("/api/search?q=");
    expect(response.status()).toBe(401);
  });

  test("export API requires authentication (redirects)", async ({ request }) => {
    const response = await request.get(
      "/api/projects/nonexistent/export?format=csv",
      { maxRedirects: 0 }
    );
    // Proxy redirects protected API routes to login
    expect(response.status()).toBe(307);
  });

  test("export API redirects unauthenticated requests", async ({ request }) => {
    const response = await request.get(
      "/api/projects/test/export?format=invalid",
      { maxRedirects: 0 }
    );
    expect(response.status()).toBe(307);
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
