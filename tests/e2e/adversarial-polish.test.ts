import { expect, test } from "@playwright/test";
import { loginAsTestUser, seedTestData } from "./helpers";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { projects } from "../../src/db/schema";

test("should sign out from the keyboard and clear the application session", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  const profile = page.getByRole("button", { name: "Profile", exact: true });
  await profile.focus();
  await page.keyboard.press("Enter");
  const signOut = page.getByRole("menuitem", { name: "Sign Out", exact: true });
  await expect(signOut).toBeVisible();
  await page.keyboard.press("End");
  await expect(signOut).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("should keep Escape focus predictable and never select a stale search result", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.route("**/api/search?**", async route => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query !== "alpha") await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ json: { results: [{ id: seed.projectId, title: "Old alpha result", type: "project", snippet: "Decision" }] } });
  });
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await expect(input).toBeFocused();
  await input.fill("alpha");
  await expect(page.getByRole("option")).toBeVisible();
  await input.press("ArrowDown");
  const before = page.url();
  await input.fill("beta");
  await input.press("Enter");
  expect(page.url()).toBe(before);
  await expect(page.getByRole("option")).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("beta");
  await input.press("ArrowDown");
  await expect(page.getByRole("option")).toBeVisible();
  await expect(page.getByRole("option")).toHaveAttribute("tabindex", "-1");
  await expect(input).toBeFocused();
  await input.press("Escape");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search projects & proposals...", exact: true })).toBeFocused();
});

test("should cancel direct project creation back to Projects", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL("/projects");
});

test("should leave mobile closed charts opaque and show desktop preview intentionally", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/projects/${seed.projectId}`);
  const idea = page.locator('[data-slot="accordion-item"]').first();
  await idea.getByRole("button", { name: "Open discussion", exact: true }).focus();
  await expect(idea.locator('[data-proposal-preview]')).not.toBeVisible();
  await expect(idea.locator('[data-vote-chart]')).toHaveCSS("mask-image", "none");
  await expect.poll(() => idea.evaluate(el => getComputedStyle(el, "::after").display)).toBe("none");
  await idea.locator('[data-slot="accordion-trigger"]').click();
  await expect.poll(() => idea.locator('[data-vote-chart]').evaluate(el => getComputedStyle(el).maskImage)).toContain("linear-gradient");
  await idea.locator('[data-slot="accordion-trigger"]').click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(idea.locator('[data-proposal-preview]')).toBeVisible();
  await expect.poll(() => idea.locator('[data-vote-chart]').evaluate(el => getComputedStyle(el).maskImage)).toContain("linear-gradient");
});

test("should keep long AI and fallback project summaries within three lines", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  if (process.env.E2E_TEST_ENABLED !== "true" || !process.env.APP_URL?.startsWith("https://localhost:") || !process.env.DATABASE_URL?.startsWith("/tmp/")) {
    throw new Error("Layout fixtures require the owned loopback test database");
  }
  const sqlite = new Database(process.env.DATABASE_URL, { fileMustExist: true });
  const db = drizzle(sqlite);
  try {
    await page.setViewportSize({ width: 320, height: 844 });
    for (const [index, summary] of ["A useful decision summary. ".repeat(100), "- Item\n".repeat(100), "> Quoted decision\n".repeat(100), "```\nCode\n\nMore code\n```", null].entries()) {
      const marker = `Summary case ${index}`;
      db.update(projects).set({ summary: summary === null ? null : `${marker}\n\n${summary}`, description: `${marker} ${"A long single paragraph for the decision. ".repeat(100)}` }).where(eq(projects.id, seed.projectId)).run();
      await page.goto("/projects");
      const card = page.locator(`a[href="/projects/${seed.projectId}"]`);
      await expect(card).toBeVisible();
      const summaryBox = card.locator(".line-clamp-3");
      await expect(summaryBox).toContainText(marker);
      const height = (await summaryBox.boundingBox())!.height;
      const lineHeight = await summaryBox.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
      expect(height).toBeLessThanOrEqual(lineHeight * 3 + 1);
      expect((await card.boundingBox())!.height).toBeLessThan(260);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally {
    sqlite.close();
  }
});


test("should preserve the full guest destination through sign-in", async ({ page }) => {
  await page.route("**/api/auth/oidc?**", route => route.fulfill({ body: "SSO context captured" }));
  await page.goto("/?source=demo&page=2");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/api\/auth\/oidc\?/);
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/?source=demo&page=2");
});
