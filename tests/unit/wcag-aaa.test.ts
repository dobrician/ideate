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
