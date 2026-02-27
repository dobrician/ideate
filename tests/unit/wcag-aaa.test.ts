import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * WCAG 2.1 AAA compliance tests for Sprint 64.
 * Validates aria-busy on loading states, motion-reduce on animations,
 * and accessible dialog close buttons.
 */

const loadingPages = [
  "src/app/dashboard/loading.tsx",
  "src/app/projects/loading.tsx",
  "src/app/admin/loading.tsx",
  "src/app/auth/loading.tsx",
  "src/app/profile/loading.tsx",
  "src/app/analytics/loading.tsx",
  "src/app/admin/workflows/loading.tsx",
  "src/app/admin/permissions/loading.tsx",
  "src/app/admin/ai-models/loading.tsx",
];

describe("WCAG AAA — Loading state accessibility", () => {
  for (const page of loadingPages) {
    const shortName = page.replace("src/app/", "").replace("/loading.tsx", "") || "root";

    describe(shortName, () => {
      const content = readFileSync(resolve(page), "utf-8");

      it("should have aria-busy=\"true\" on loading container", () => {
        expect(content).toContain('aria-busy="true"');
      });

      it('should have role="status" on loading container', () => {
        expect(content).toContain('role="status"');
      });

      it("should have sr-only loading text for screen readers", () => {
        expect(content).toMatch(/className="sr-only".*Loading/s);
      });
    });
  }
});

describe("WCAG AAA — Reduced motion", () => {
  it("Skeleton component should include motion-reduce:animate-none", () => {
    const content = readFileSync(resolve("src/components/ui/skeleton.tsx"), "utf-8");
    expect(content).toContain("motion-reduce:animate-none");
  });

  it("Skeleton component should have aria-hidden for decorative skeletons", () => {
    const content = readFileSync(resolve("src/components/ui/skeleton.tsx"), "utf-8");
    expect(content).toContain('aria-hidden="true"');
  });

  for (const page of loadingPages) {
    const shortName = page.replace("src/app/", "").replace("/loading.tsx", "") || "root";
    const content = readFileSync(resolve(page), "utf-8");

    // Only check pages that use raw animate-pulse (not via Skeleton component)
    if (content.includes("animate-pulse") && !content.includes("Skeleton")) {
      it(`${shortName} raw animate-pulse should include motion-reduce:animate-none`, () => {
        const lines = content.split("\n").filter((l) => l.includes("animate-pulse"));
        for (const line of lines) {
          expect(line).toContain("motion-reduce:animate-none");
        }
      });
    }
  }
});

describe("WCAG AAA — Enhanced focus indicators", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf-8");

  it("should have 3px focus-visible ring on all focusable elements", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid var(--ring)");
  });

  it("should have outline-offset on focus-visible", () => {
    expect(css).toContain("outline-offset: 2px");
  });

  it("should have card-as-link focus ring", () => {
    expect(css).toContain('a[data-slot="card"]:focus-visible');
  });
});

describe("WCAG AAA — Forced-colors extended coverage", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf-8");
  const forcedSection = css.split("@media (forced-colors: active)")[1] ?? "";

  it("search listbox gets border in forced-colors", () => {
    expect(forcedSection).toContain('[role="listbox"]');
  });

  it("selected option gets Highlight outline in forced-colors", () => {
    expect(forcedSection).toContain('[role="option"][aria-selected="true"]');
    expect(forcedSection).toContain("Highlight");
  });

  it("form inputs get border in forced-colors", () => {
    expect(forcedSection).toContain("input");
    expect(forcedSection).toContain("textarea");
    expect(forcedSection).toContain("select");
  });

  it("progress bars get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="progressbar"]');
  });

  it("links remain underlined in forced-colors", () => {
    expect(forcedSection).toContain("text-decoration: underline");
  });

  it("dialogs get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="dialog"]');
  });

  it("checked radio buttons get Highlight outline in forced-colors", () => {
    expect(forcedSection).toContain('[role="radio"][aria-checked="true"]');
  });

  it("tab panels and selected tabs get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="tabpanel"]');
    expect(forcedSection).toContain('[role="tab"][aria-selected="true"]');
  });
});

describe("WCAG AAA — Embeddings page progressbar ARIA", () => {
  const content = readFileSync(resolve("src/app/admin/embeddings/page.tsx"), "utf-8");

  it("should have role='progressbar' on coverage bars", () => {
    expect(content).toContain('role="progressbar"');
  });

  it("should have aria-valuenow on coverage bars", () => {
    expect(content).toContain("aria-valuenow={pct}");
  });

  it("should have aria-valuemin and aria-valuemax on coverage bars", () => {
    expect(content).toContain("aria-valuemin={0}");
    expect(content).toContain("aria-valuemax={100}");
  });

  it("should have aria-label on coverage bars", () => {
    expect(content).toContain("aria-label={");
  });
});

describe("WCAG AAA — Dialog close button touch target", () => {
  it("should have 44px close button (h-11 w-11)", () => {
    const content = readFileSync(resolve("src/components/ui/dialog.tsx"), "utf-8");
    // h-11 = 44px, w-11 = 44px — meets WCAG 2.1 AAA touch target
    expect(content).toMatch(/h-11.*w-11|w-11.*h-11/);
  });

  it("should have sr-only close label", () => {
    const content = readFileSync(resolve("src/components/ui/dialog.tsx"), "utf-8");
    expect(content).toContain("sr-only");
    expect(content).toContain("Close");
  });
});

describe("WCAG AAA — Sprint 67: Form error forced-colors", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf-8");
  const forcedSection = css.split("@media (forced-colors: active)")[1] ?? "";

  it("form validation errors get LinkText color in forced-colors", () => {
    expect(forcedSection).toContain('[role="alert"]');
    expect(forcedSection).toContain("LinkText");
  });

  it("aria-invalid inputs get outlined in forced-colors", () => {
    expect(forcedSection).toContain('[aria-invalid="true"]');
  });

  it("tooltips and popovers get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="tooltip"]');
    expect(forcedSection).toContain('[data-slot="tooltip-content"]');
    expect(forcedSection).toContain('[data-slot="popover-content"]');
  });

  it("pressed vote buttons get Highlight outline in forced-colors", () => {
    expect(forcedSection).toContain('[aria-pressed="true"]');
    expect(forcedSection).toContain("Highlight");
  });

  it("table elements get border in forced-colors", () => {
    expect(forcedSection).toMatch(/\btable\b/);
    expect(forcedSection).toContain("th,");
    expect(forcedSection).toContain("td {");
  });

  it("switch and checkbox controls get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="switch"]');
    expect(forcedSection).toContain('[role="checkbox"]');
  });

  it("checked switch/checkbox get Highlight outline", () => {
    expect(forcedSection).toContain('[role="switch"][aria-checked="true"]');
    expect(forcedSection).toContain('[role="checkbox"][aria-checked="true"]');
  });

  it("separators get border-color in forced-colors", () => {
    expect(forcedSection).toContain('[role="separator"]');
  });

  it("status role elements get border in forced-colors", () => {
    expect(forcedSection).toContain('[role="status"]');
  });
});

describe("WCAG AAA — Sprint 67: High contrast chart palette", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf-8");

  it("should have prefers-contrast: more media query", () => {
    expect(css).toContain("@media (prefers-contrast: more)");
  });

  it("chart variables override in high contrast mode", () => {
    const contrastSection = css.split("@media (prefers-contrast: more)")[1] ?? "";
    expect(contrastSection).toContain("--chart-1:");
    expect(contrastSection).toContain("--chart-2:");
    expect(contrastSection).toContain("--chart-3:");
  });

  it("dark mode chart overrides exist in high contrast", () => {
    const contrastSection = css.split("@media (prefers-contrast: more)")[1] ?? "";
    expect(contrastSection).toContain(".dark");
  });
});

describe("WCAG AAA — Skip navigation", () => {
  it("skip nav component targets #main-content", () => {
    const content = readFileSync(resolve("src/components/skip-nav.tsx"), "utf-8");
    expect(content).toContain('#main-content');
  });

  it("skip nav link has 44px minimum touch target", () => {
    const content = readFileSync(resolve("src/components/skip-nav.tsx"), "utf-8");
    expect(content).toContain("min-h-[44px]");
    expect(content).toContain("min-w-[44px]");
  });
});
