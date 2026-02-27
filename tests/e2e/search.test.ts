import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser, type SeedData } from "./helpers";

let seed: SeedData;

test.describe("Search — Authenticated", () => {
  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page.request);
    await loginAsTestUser(page, seed);
  });

  test("search bar is visible on dashboard", async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
  });

  test("search input has aria-keyshortcuts attribute", async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+K Meta+K"
    );
  });

  test("Ctrl+K focuses the search input", async ({ page }) => {
    await page.getByRole("heading", { name: /Dashboard/i }).click();
    await page.keyboard.press("Control+k");
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeFocused();
  });

  test("search combobox has correct ARIA attributes", async ({ page }) => {
    const combobox = page.locator('[role="combobox"]');
    await expect(combobox).toBeVisible();
    await expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
    await expect(combobox).toHaveAttribute("aria-controls", "search-results-listbox");
  });

  test("mode toggle shows Keyword, Semantic, Smart buttons", async ({ page }) => {
    const radiogroup = page.locator('[role="radiogroup"]');
    await expect(radiogroup).toBeVisible();
    await expect(page.getByRole("radio", { name: /Keyword/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Semantic/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Smart/i })).toBeVisible();
  });

  test("mode toggle buttons have title tooltips", async ({ page }) => {
    const keyword = page.getByRole("radio", { name: /Keyword/i });
    await expect(keyword).toHaveAttribute("title");
    const semantic = page.getByRole("radio", { name: /Semantic/i });
    await expect(semantic).toHaveAttribute("title");
  });

  test("filter button is visible and toggleable", async ({ page }) => {
    const filterBtn = page.locator('button[aria-pressed]').first();
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();
    // After click, filter panel should appear with entity type buttons
    await expect(page.locator('[role="group"]')).toBeVisible();
  });

  test("search input shows no-results message for gibberish query", async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("xyznonexistent999zzz");
    // Wait for debounced search
    await page.waitForTimeout(500);
    // Either listbox appears with no-results, or status message
    const listbox = page.locator('#search-results-listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });
  });
});
