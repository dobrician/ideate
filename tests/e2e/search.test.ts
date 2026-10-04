import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let seed: SeedData;

test.describe("Search — Authenticated", () => {
  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
    await page.getByRole("button", { name: "Search projects & proposals...", exact: true }).click();
  });

  test("search bar is visible on dashboard", async ({ page }) => {
    const searchInput = page.getByRole("combobox").getByRole("searchbox");
    await expect(searchInput).toBeVisible();
  });

  test("search input has aria-keyshortcuts attribute", async ({ page }) => {
    const searchInput = page.getByRole("combobox").getByRole("searchbox");
    await expect(searchInput).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+K Meta+K"
    );
  });

  test("Ctrl+K focuses the search input", async ({ page }) => {
    await page.getByRole("heading", { name: /Projects/i }).click();
    await page.keyboard.press("Control+k");
    const searchInput = page.getByRole("combobox").getByRole("searchbox");
    await expect(searchInput).toBeFocused();
  });

  test("search combobox has correct ARIA attributes", async ({ page }) => {
    const combobox = page.locator('[role="combobox"]');
    await expect(combobox).toBeVisible();
    await expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
    await expect(combobox).toHaveAttribute("aria-controls", /.+/);
  });

  test("search exposes one query without technical mode or entity selectors", async ({ page }) => {
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.locator('button[aria-pressed]')).toHaveCount(0);
    const request = page.waitForRequest(r => r.url().includes("/api/search?"));
    await page.getByRole("combobox").getByRole("searchbox").fill("Test");
    expect(new URL((await request).url()).searchParams.get("mode")).toBe("fts");
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("search input shows no-results message for gibberish query", async ({ page }) => {
    const searchInput = page.getByRole("combobox").getByRole("searchbox");
    await searchInput.fill("xyznonexistent999zzz");
    // Wait for debounced search
    await page.waitForTimeout(500);
    // Either listbox appears with no-results, or status message
    const listbox = page.getByText("No results found", { exact: true });
    await expect(listbox).toBeVisible({ timeout: 5000 });
  });
});
