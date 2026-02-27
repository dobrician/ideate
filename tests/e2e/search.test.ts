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
    // Click somewhere else first to ensure search is not focused
    await page.getByRole("heading", { name: /Dashboard/i }).click();

    // Press Ctrl+K
    await page.keyboard.press("Control+k");

    // The search input should now be focused
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeFocused();
  });

  test("search combobox has correct ARIA attributes", async ({ page }) => {
    const combobox = page.locator('[role="combobox"]');
    await expect(combobox).toBeVisible();
    await expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
    await expect(combobox).toHaveAttribute("aria-controls", "search-results-listbox");
  });
});
