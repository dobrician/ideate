import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("PWA Manifest", () => {
  const manifestPath = join(process.cwd(), "public", "manifest.json");
  let manifest: Record<string, unknown>;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    manifest = {};
  }

  it("should have a name", () => {
    expect(manifest.name).toBeDefined();
    expect(typeof manifest.name).toBe("string");
  });

  it("should have a short_name", () => {
    expect(manifest.short_name).toBeDefined();
    expect(typeof manifest.short_name).toBe("string");
  });

  it("should have display set to standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("should have a start_url", () => {
    expect(manifest.start_url).toBe("/");
  });

  it("should have theme_color", () => {
    expect(manifest.theme_color).toBeDefined();
  });

  it("should have background_color", () => {
    expect(manifest.background_color).toBeDefined();
  });

  it("should have icons with required sizes", () => {
    const icons = manifest.icons as Array<{ sizes: string }>;
    expect(icons).toBeDefined();
    expect(Array.isArray(icons)).toBe(true);
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("should have app shortcuts", () => {
    const shortcuts = manifest.shortcuts as Array<{ name: string; url: string }>;
    expect(shortcuts).toBeDefined();
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(shortcuts.length).toBeGreaterThan(0);
  });

  it("should have shortcuts with valid URLs", () => {
    const shortcuts = manifest.shortcuts as Array<{ url: string }>;
    for (const shortcut of shortcuts) {
      expect(shortcut.url).toMatch(/^\//);
    }
  });

  it("should have categories", () => {
    const categories = manifest.categories as string[];
    expect(categories).toContain("productivity");
  });

  it("should have display_override", () => {
    const overrides = manifest.display_override as string[];
    expect(overrides).toBeDefined();
    expect(overrides).toContain("standalone");
  });

  it("should set prefer_related_applications to false", () => {
    expect(manifest.prefer_related_applications).toBe(false);
  });

  it("should have lang set to en", () => {
    expect(manifest.lang).toBe("en");
  });

  it("should have dir set to ltr", () => {
    expect(manifest.dir).toBe("ltr");
  });
});
