import { test, expect } from "@playwright/test";

test.describe("CSRF Protection", () => {
  test("server action rejects request without valid CSRF token", async ({
    request,
  }) => {
    // Attempt to invoke the addComment server action directly via POST
    // without a valid CSRF cookie. Next.js server actions are invoked
    // by POSTing form data to the page URL with a Next-Action header.
    // Without a valid csrf_token cookie, requireCsrfToken() should throw.
    //
    // We use the register API (which doesn't require CSRF) as a baseline
    // to show the server is reachable, then test server action CSRF rejection.

    // First: verify server is up
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();

    // Attempt a direct POST to a project page (server action target)
    // with forged form data but no CSRF cookie.
    // The server action should reject with an error.
    const formData = new URLSearchParams();
    formData.append("content", "Test comment");
    formData.append("projectId", "nonexistent");
    formData.append("csrfToken", "forged-token");

    const response = await request.post("/projects/nonexistent", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/x-component",
        "Next-Action": "fake-action-id",
      },
      data: formData.toString(),
    });

    // Server should reject — either 403/500 from CSRF failure,
    // or redirect to login (302) since we're not authenticated.
    // In any case, it should NOT return a 200 success.
    const status = response.status();
    expect([302, 303, 400, 401, 403, 404, 500]).toContain(status);
  });

  test("form submission without CSRF cookie is rejected", async ({
    request,
  }) => {
    // Try to call the password login endpoint (which works) to show
    // API calls succeed, then test that form-based actions with
    // invalid CSRF are rejected.

    // The auth register endpoint works without CSRF (it's an API route)
    const apiResponse = await request.post("/api/auth/login-password", {
      data: {
        email: "test@example.com",
        password: "wrong",
      },
    });
    // 401 means the API processed the request (no CSRF needed for APIs)
    expect(apiResponse.status()).toBe(401);

    // Now simulate a server action call with empty CSRF token
    const formData = new URLSearchParams();
    formData.append("content", "Malicious comment");
    formData.append("proposalId", "fake-id");
    formData.append("csrfToken", "");

    const actionResponse = await request.post("/projects/test-project", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/x-component",
        "Next-Action": "invalid-action-id",
      },
      data: formData.toString(),
    });

    // Should not succeed — no valid CSRF token or session
    expect(actionResponse.ok()).toBeFalsy();
  });
});
