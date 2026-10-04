// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
const state = vi.hoisted(() => ({ projects: [{ id: "public-project", updatedAt: new Date("2026-10-04") }] }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => null }));
vi.mock("@/lib/i18n-server", () => ({ getTranslations: async () => ({ t: (key: string) => key }) }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: async () => state.projects }) } }));
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("PublicOrigin", () => {
  it("should use the configured origin in structured data", async () => {
    vi.stubEnv("APP_URL", "https://test.ideate.surcod.ro");
    const { default: HomePage } = await import("@/app/page");
    const { container } = render(await HomePage());
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
    expect(data.url).toBe("https://test.ideate.surcod.ro");
  });
  it("should list configured public destinations without the retired dashboard", async () => {
    vi.stubEnv("APP_URL", "https://test.ideate.surcod.ro");
    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    expect(result.map(entry => entry.url)).toEqual([
      "https://test.ideate.surcod.ro", "https://test.ideate.surcod.ro/projects",
      "https://test.ideate.surcod.ro/projects/public-project",
    ]);
  });
  it("should default sitemap URLs to the new production origin", async () => {
    vi.stubEnv("APP_URL", "");
    const { default: sitemap } = await import("@/app/sitemap");
    expect((await sitemap())[0].url).toBe("https://ideate.surcod.ro");
  });
});
