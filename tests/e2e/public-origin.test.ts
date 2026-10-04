import { test, expect } from "@playwright/test";

test.describe("Public origin", () => {
  test("should publish configured origin and omit the retired dashboard", async ({ request, baseURL }) => {
    const homepage = await request.get("/");
    expect(homepage.status()).toBe(200);
    const html = await homepage.text();
    const script = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(script).not.toBeNull();
    expect(JSON.parse(script![1]).url).toBe(baseURL);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain(`${baseURL}/projects`);
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("idea.surmont.co");
  });
});
