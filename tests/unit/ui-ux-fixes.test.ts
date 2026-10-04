import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Import SUT ─────────────────────────────────────────────────

import { t, getTranslations, type Locale } from "@/lib/i18n";
import {
  statusBadgeClass,
  statusLabel,
  deadlineBadge,
} from "@/lib/status-utils";

// ============================================================
// #54 — Pluralization (i18n _one variants)
// ============================================================

describe("Pluralization (#54)", () => {
  describe("t() with _one key variants", () => {
    it("uses plural form when count > 1", () => {
      const result = t("en", "projects.total", { count: 5 });
      expect(result).toBe("5 projects total");
    });

    it("uses singular _one form when count === 1", () => {
      const result = t("en", "projects.total", { count: 1 });
      expect(result).toBe("1 project total");
    });

    it("uses plural form when count === 0", () => {
      const result = t("en", "projects.total", { count: 0 });
      expect(result).toBe("0 projects total");
    });

    it("uses plural form when count === 2", () => {
      const result = t("en", "projects.total", { count: 2 });
      expect(result).toBe("2 projects total");
    });

    it("uses plural form for negative counts", () => {
      const result = t("en", "projects.total", { count: -1 });
      expect(result).toBe("-1 projects total");
    });

    it("pluralizes in Romanian locale", () => {
      const resultPlural = t("ro", "projects.total", { count: 5 });
      expect(resultPlural).toContain("5");

      const resultSingular = t("ro", "projects.total", { count: 1 });
      expect(resultSingular).toContain("1");

      // Singular and plural should be different strings
      expect(resultSingular).not.toBe(resultPlural.replace("5", "1"));
    });

    it("falls back to plural when no _one variant exists", () => {
      // A key that has no _one variant should still work
      const result = t("en", "common.loading", { count: 1 });
      expect(result).toBe("Loading...");
    });

    it("handles count as string number", () => {
      // count is typed as string | number; "1" as string should not trigger _one
      const result = t("en", "projects.total", { count: "1" });
      // Number("1") === 1, so _one variant is used
      expect(result).toBe("1 project total");
    });

    it("handles count as float (1.0 triggers singular)", () => {
      const result = t("en", "projects.total", { count: 1.0 });
      expect(result).toBe("1 project total");
    });

    it("does not trigger _one for 1.5", () => {
      const result = t("en", "projects.total", { count: 1.5 });
      expect(result).toBe("1.5 projects total");
    });
  });

  describe("all _one variants exist in both locales", () => {
    const keysWithPlurals = [
      "projects.total",
      "admin.registeredUsers",
      "admin.projectCount",
      "dashboard.totalVotes",
    ];

    for (const key of keysWithPlurals) {
      it(`en: "${key}" has a _one variant`, () => {
        const plural = t("en", key, { count: 5 });
        const singular = t("en", key, { count: 1 });
        // They should produce different output
        expect(singular).not.toBe(plural.replace("5", "1"));
      });

      it(`ro: "${key}" translates without falling back to key`, () => {
        const result = t("ro", key, { count: 3 });
        expect(result).not.toBe(key);
      });
    }
  });
});

// ============================================================
// #65 — Deadline badge: 4-tier color system
// ============================================================

describe("Deadline Badge 4-tier (#65)", () => {
  const mockT = (key: string, vars?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      "dashboard.deadlineOverdue": "Overdue",
      "dashboard.deadlineDaysLeft": `${vars?.count}d left`,
    };
    return map[key] ?? key;
  };

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-02-16T12:00:00Z").getTime()
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for null deadline", () => {
    expect(deadlineBadge(null, mockT)).toBeNull();
  });

  // Tier 1: overdue (days < 0) → red
  it("returns red badge for overdue deadline", () => {
    const past = new Date("2026-02-15T00:00:00Z");
    const badge = deadlineBadge(past, mockT)!;
    expect(badge.label).toBe("Overdue");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
    expect(badge.className).toContain("dark:bg-red-900/50");
    expect(badge.className).toContain("dark:text-red-300");
  });

  // Tier 2: urgent (0-3 days) → red
  it("returns red badge for 0 days left", () => {
    const today = new Date("2026-02-16T23:59:59Z");
    const badge = deadlineBadge(today, mockT)!;
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("returns red badge for 1 day left", () => {
    const tomorrow = new Date("2026-02-17T12:00:00Z");
    const badge = deadlineBadge(tomorrow, mockT)!;
    expect(badge.label).toBe("1d left");
    expect(badge.className).toContain("red");
  });

  it("returns red badge for 3 days left", () => {
    const threeDays = new Date("2026-02-19T12:00:00Z");
    const badge = deadlineBadge(threeDays, mockT)!;
    expect(badge.label).toBe("3d left");
    expect(badge.className).toContain("red");
  });

  // Tier 3: soon (4-7 days) → amber
  it("returns amber badge for 4 days left", () => {
    const fourDays = new Date("2026-02-20T12:00:00Z");
    const badge = deadlineBadge(fourDays, mockT)!;
    expect(badge.label).toBe("4d left");
    expect(badge.className).toContain("bg-amber-100");
    expect(badge.className).toContain("text-amber-800");
  });

  it("returns amber badge for 7 days left", () => {
    const sevenDays = new Date("2026-02-23T12:00:00Z");
    const badge = deadlineBadge(sevenDays, mockT)!;
    expect(badge.label).toBe("7d left");
    expect(badge.className).toContain("amber");
  });

  // Tier 4: comfortable (>7 days) → blue
  it("returns blue badge for 8 days", () => {
    const eightDays = new Date("2026-02-24T13:00:00Z");
    const badge = deadlineBadge(eightDays, mockT)!;
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-800");
    expect(badge.className).toContain("dark:bg-blue-900/50");
    expect(badge.className).toContain("dark:text-blue-300");
  });

  it("returns blue badge for 30 days", () => {
    const thirtyDays = new Date("2026-03-18T12:00:00Z");
    const badge = deadlineBadge(thirtyDays, mockT)!;
    expect(badge.className).toContain("blue");
  });

  it("returns blue badge for 365 days", () => {
    const farFuture = new Date("2027-02-16T12:00:00Z");
    const badge = deadlineBadge(farFuture, mockT)!;
    expect(badge.className).toContain("blue");
  });

  // Boundary precision
  it("boundary: exactly midnight tomorrow uses correct tier", () => {
    const midnight = new Date("2026-02-17T00:00:00Z");
    const badge = deadlineBadge(midnight, mockT)!;
    // Math.ceil(diff / 86_400_000) at 12:00 → ceil(0.5) = 1
    expect(badge.className).toContain("red");
  });

  it("all badges include border-transparent", () => {
    const dates = [
      new Date("2026-02-15T00:00:00Z"), // overdue
      new Date("2026-02-17T12:00:00Z"), // 1d (red)
      new Date("2026-02-21T12:00:00Z"), // 5d (amber)
      new Date("2026-03-01T12:00:00Z"), // 13d (blue)
    ];
    for (const d of dates) {
      const badge = deadlineBadge(d, mockT)!;
      expect(badge.className).toContain("border-transparent");
    }
  });
});

// ============================================================
// Status utils edge cases (covers #65 regression)
// ============================================================

describe("statusBadgeClass edge cases", () => {
  it("handles null-like values gracefully", () => {
    expect(statusBadgeClass("")).toContain("bg-muted");
    expect(statusBadgeClass("unknown")).toContain("bg-muted");
    expect(statusBadgeClass("ACTIVE")).toContain("bg-muted"); // case-sensitive
  });

  it("active returns emerald (not green/blue)", () => {
    const cls = statusBadgeClass("active");
    expect(cls).toContain("emerald");
    expect(cls).not.toContain("blue");
    expect(cls).not.toContain("green-");
  });
});

describe("statusLabel edge cases", () => {
  const mockT = vi.fn((key: string) => `t:${key}`);

  it("returns raw for XSS-like status", () => {
    const result = statusLabel("<script>alert(1)</script>", mockT);
    expect(result).toBe("<script>alert(1)</script>");
  });

  it("returns raw for unicode status", () => {
    const result = statusLabel("activé", mockT);
    expect(result).toBe("activé");
  });

  it("returns raw for emoji status", () => {
    const result = statusLabel("🚀", mockT);
    expect(result).toBe("🚀");
  });

  it("returns raw for very long status", () => {
    const longStatus = "x".repeat(200);
    const result = statusLabel(longStatus, mockT);
    expect(result).toBe(longStatus);
  });

  it("returns raw for RTL status", () => {
    const rtl = "مشروع";
    const result = statusLabel(rtl, mockT);
    expect(result).toBe(rtl);
  });
});

// ============================================================
// #52 — Proposal title overflow classes (unit-level)
// ============================================================

describe("Proposal title overflow classes (#52)", () => {
  it("title span has break-words and line-clamp-2", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-item.tsx", "utf-8");
    expect(src).toContain("break-words");
    expect(src).toContain("line-clamp-2");
  });

  it("author is secondary information in expanded details", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-item.tsx", "utf-8");
    // Authorship is available to assistive technology and on expansion.
    expect(src).toContain('className="sr-only"');
    expect(src).toContain("proposals.by");
  });
});

// ============================================================
// #69 — Details link styling (unit-level)
// ============================================================

describe("Intentional proposal disclosure", () => {
  it("should expose the summary through an accordion trigger", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-item.tsx", "utf-8");
    expect(src).toContain("AccordionTrigger");
    expect(src).toContain("proposal.summary || proposal.description");
    expect(src).not.toContain('t("proposals.details")');
  });
});

// ============================================================
// #56 — Sidebar form clipping → replaced with Sheet drawer
// ============================================================

describe("Proposal form uses Sheet drawer (#56)", () => {
  it("ProposalForm uses Sheet instead of Dialog", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-form.tsx", "utf-8");
    expect(src).toContain("Sheet");
    expect(src).toContain("SheetContent");
    expect(src).toContain('side="left"');
  });

  it("project page has no two-column sidebar layout", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/projects/[id]/page.tsx", "utf-8");
    expect(src).not.toContain("ProposalFormInline");
    expect(src).not.toContain("lg:grid-cols-[1.6fr_1fr]");
  });
});

// ============================================================
// #59 — Input field borders (CSS variables)
// ============================================================

describe("Decision palette (#85)", () => {
  it("uses opaque neutral borders and stronger dark input boundaries", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("src/app/globals.css", "utf-8");
    expect(css).toContain("--border: #CFD8CF");
    expect(css).toContain("--border: #3B453E");
    expect(css).toContain("--input: #4D5A50");
  });

  it("calibrates the brand separately for each theme and shares its focus ring", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("src/app/globals.css", "utf-8");
    expect(css).toContain("--primary: #216F59");
    expect(css).toContain("--primary: #75B69A");
    expect(css.match(/--ring: var\(--primary\)/g)).toHaveLength(2);
  });
});

// ============================================================
// #60 — Links: global style in CSS
// ============================================================

describe("Global link styles (#60)", () => {
  it("CSS has a:not([class]) rule with primary color", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("src/app/globals.css", "utf-8");
    expect(css).toContain("a:not([class])");
    expect(css).toContain("var(--primary)");
    expect(css).toContain("text-decoration: underline");
    expect(css).toContain("text-underline-offset: 2px");
  });

  it("hover thickens the underline", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("src/app/globals.css", "utf-8");
    expect(css).toContain("a:not([class]):hover");
    expect(css).toContain("text-decoration-thickness: 2px");
  });
});

// ============================================================
// #62 — Dark mode stat cards contrast
// ============================================================

describe("Dark mode card contrast (#62)", () => {
  it("CSS has .dark [data-slot=card] rule", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("src/app/globals.css", "utf-8");
    expect(css).toContain('.dark [data-slot="card"]');
    expect(css).toContain("border-color: var(--border)");
    expect(css).toContain("box-shadow:");
  });
});

// ============================================================
// #66 — Comment section spacing
// ============================================================

describe("Comment section spacing (#66)", () => {
  it("empty state uses py-6 not py-12", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/comment-thread.tsx", "utf-8");
    expect(src).toContain("py-6");
    expect(src).not.toContain("py-12");
  });

  it("empty state icon is h-6 w-6 not h-8 w-8", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/comment-thread.tsx", "utf-8");
    expect(src).toContain("h-6 w-6");
    // h-8 w-8 should not appear in the empty state context
    expect(src).not.toContain("h-8 w-8");
  });
});

// ============================================================
// #67 — Romanian translation overflow prevention
// ============================================================

describe("Romanian translation overflow (#67)", () => {
  it("proposal form description area has flex-wrap", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-form-fields.tsx", "utf-8");
    expect(src).toContain("flex flex-wrap");
  });

  it("Write/Preview buttons have shrink-0", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-form-fields.tsx", "utf-8");
    // Each button should have shrink-0
    const shrinkMatches = src.match(/shrink-0.*?items-center.*?gap-1.*?rounded/g);
    expect(shrinkMatches).toBeTruthy();
    expect(shrinkMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("markdown hint has break-words", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/proposal-form-fields.tsx", "utf-8");
    expect(src).toContain("break-words text-xs text-muted-foreground");
  });
});
