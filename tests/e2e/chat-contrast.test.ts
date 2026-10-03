import { test, expect, type Page } from "@playwright/test";
import { seedTestData, loginAsTestUser } from "./helpers";

type Surface = "project" | "proposal";

/** Open the shared chat component in either discussion surface. */
async function openDiscussion(page: Page, projectId: string, surface: Surface) {
  await page.goto(`/projects/${projectId}`);
  if (surface === "proposal") {
    await page.getByRole("button", { name: "Open discussion", exact: true }).first().click();
    return page.locator('[data-slot="sheet-content"]');
  }
  return page.locator("main");
}

for (const surface of ["project", "proposal"] as const) {
  test(`should keep ${surface} messages readable and distinct in both themes`, async ({ page }) => {
    const owner = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, owner);
    let discussion = await openDiscussion(page, owner.projectId, surface);
    const ownText = "Own readable message: **bold** *italic* `code` [link](https://example.com) ~~removed~~";
    await discussion.locator("textarea[name='content']").last().fill(ownText);
    await discussion.locator("textarea[name='content']").last().press("Enter");
    await expect(discussion.locator('[data-chat-bubble]').filter({ hasText: "Own readable message:" })).toBeVisible();

    await expect(discussion.locator("textarea[name='content']").last()).toHaveValue("");

    const other = await seedTestData(page.request, { role: "admin" });
    await loginAsTestUser(page, other);
    discussion = await openDiscussion(page, owner.projectId, surface);
    await discussion.locator("textarea[name='content']").last().fill("Received readable message: **bold** *italic* `code` [link](https://example.com)");
    await discussion.locator("textarea[name='content']").last().press("Enter");
    await expect(discussion.locator('[data-chat-bubble]').filter({ hasText: "Received readable message:" })).toBeVisible();

    await expect(discussion.locator("textarea[name='content']").last()).toHaveValue("");

    await loginAsTestUser(page, owner);
    discussion = await openDiscussion(page, owner.projectId, surface);
    for (const theme of ["dark", "light"]) {
      await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
      const own = discussion.locator('[data-chat-bubble][data-own="true"]').filter({ hasText: "Own readable message:" });
      const received = discussion.locator('[data-chat-bubble][data-own="false"]').filter({ hasText: "Received readable message:" });
      await expect(own).toBeVisible();
      await expect(received).toBeVisible();
      for (const bubble of [own, received]) {
        // Wait for any theme color transitions before measuring the actual rendered colors.
        await bubble.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)); });
        const contrast = await bubble.evaluate(el => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas color conversion is unavailable");
          const luminance = (color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
          };
          const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const background = luminance(getComputedStyle(el).backgroundColor);
          return {
            text: Array.from(el.querySelectorAll("p,strong,em,code,a,del")).map(node => ratio(luminance(getComputedStyle(node).color), background)),
            separation: ratio(background, luminance(getComputedStyle(document.body).backgroundColor)),
          };
        });
        expect(contrast.text.length).toBeGreaterThanOrEqual(5);
        for (const ratio of contrast.text) expect(ratio).toBeGreaterThanOrEqual(4.5);
        if (theme === "light" && bubble === received) expect(contrast.separation).toBeGreaterThanOrEqual(1.15);
      }
      await expect(received).toHaveCSS("border-top-width", "1px");
      await expect(own.getByRole("link", { name: "link", exact: true })).toHaveCSS("text-decoration-line", "underline");
    }
  });
}
