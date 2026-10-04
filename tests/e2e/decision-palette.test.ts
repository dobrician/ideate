import { expect, test, type Locator } from "@playwright/test";
import { loginAsTestUser, seedTestData } from "./helpers";

/** Measure the actual opaque foreground/background pair after exact-color assertions. */
async function contrastOf(target: Locator): Promise<number> {
  return target.evaluate(el => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const style = getComputedStyle(el);
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test("should apply readable semantic colors to selected votes, chart and drawer in both themes", async ({ page }) => {
  const seed = await seedTestData(page.request);
  await loginAsTestUser(page, seed);
  await page.goto(`/projects/${seed.projectId}`);
  const idea = page.locator('[data-slot="accordion-item"]').first();
  const pro = idea.getByRole("button", { name: /^Pro \(/ });
  const contra = idea.getByRole("button", { name: /^Contra \(/ });
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
    await expect(pro).toHaveAttribute("aria-pressed", "true");
    await expect(pro).toHaveCSS("background-color", dark ? "rgb(28, 48, 40)" : "rgb(224, 236, 228)");
    expect(await contrastOf(pro)).toBeGreaterThanOrEqual(4.5);
    await pro.focus();
    const chart = idea.locator("[data-vote-chart]");
    await expect(chart.locator(".bg-vote-pro")).toHaveCSS("background-color", dark ? "rgb(28, 48, 40)" : "rgb(224, 236, 228)");
    const height = (await chart.boundingBox())!.height;
    await contra.click();
    await expect(contra).toHaveAttribute("aria-pressed", "true");
    await expect(contra).toHaveCSS("background-color", dark ? "rgb(52, 38, 38)" : "rgb(241, 228, 224)");
    expect(await contrastOf(contra)).toBeGreaterThanOrEqual(4.5);
    await expect(chart.locator(".bg-vote-contra")).toHaveCSS("background-color", dark ? "rgb(52, 38, 38)" : "rgb(241, 228, 224)");
    await idea.locator('[data-slot="accordion-trigger"]').click();
    await expect(idea).toHaveAttribute("data-state", "open");
    expect((await chart.boundingBox())!.height).toBe(height);
    await idea.locator('[data-slot="accordion-trigger"]').click();
    await pro.click();
    await expect(pro).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /New Proposal/ }).click();
    const drawer = page.locator('[data-slot="sheet-content"]');
    expect(await contrastOf(drawer.getByRole("button", { name: "Submit Proposal", exact: true }))).toBeGreaterThanOrEqual(4.5);
    const initialPro = drawer.getByRole("button", { name: "Pro", exact: true });
    // Closing the drawer preserves the draft, including the previous vote choice.
    await initialPro.click();
    await expect(initialPro).toHaveCSS("background-color", dark ? "rgb(28, 48, 40)" : "rgb(224, 236, 228)");
    expect(await contrastOf(initialPro)).toBeGreaterThanOrEqual(4.5);
    const initialContra = drawer.getByRole("button", { name: "Contra", exact: true });
    await initialContra.click();
    await expect(initialContra).toHaveCSS("background-color", dark ? "rgb(52, 38, 38)" : "rgb(241, 228, 224)");
    expect(await contrastOf(initialContra)).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  }
});
