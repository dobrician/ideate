import { test, expect } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

test("should keep the floating brand and account utilities usable on a narrow screen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  await page.setViewportSize({ width: 320, height: 640 });
  const header = page.getByRole("banner");
  const brand = header.getByRole("link", { name: "Ideate", exact: true });
  await expect(brand).toContainText("ideate");
  await expect(brand.locator("[data-brand-mark]")).toBeVisible();
  const nav = header.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  await expect(page.getByText("Live Activity", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Using polling mode", { exact: true })).toHaveCount(0);
  expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await header.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Switch to Romanian/ })).toBeVisible();
  await page.keyboard.press("Escape");
  const themeToggle = header.getByRole("button", { name: "Toggle theme", exact: true });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await header.getByRole("button", { name: "Search projects & proposals...", exact: true }).click();
  await expect(header.locator("#app-search input").first()).toBeFocused();
});

test("should serve matching vector and correctly sized install icons", async ({ request }) => {
  const logo = await request.get("/logo.svg");
  expect(logo.ok()).toBe(true);
  expect(await logo.text()).toContain('circle cx="32" cy="20"');
  for (const size of [192, 512]) {
    const response = await request.get(`/icons/icon-${size}.png`);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  const favicon = await request.get("/favicon.ico");
  expect(favicon.ok()).toBe(true);
  expect((await favicon.body()).readUInt16LE(2)).toBe(1);
});
