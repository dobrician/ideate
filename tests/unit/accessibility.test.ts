import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  prefersReducedMotion,
  prefersHighContrast,
  trapFocus,
  generateAriaId,
  checkContrastRatio,
} from "@/lib/a11y";

describe("Accessibility Utilities", () => {
  describe("announce", () => {
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockCreateElement: ReturnType<typeof vi.fn>;
    let createdEl: Record<string, string | (() => void)>;

    beforeEach(() => {
      vi.useFakeTimers();
      createdEl = {
        setAttribute: vi.fn(),
        textContent: "",
        className: "",
        style: { cssText: "" },
      } as unknown as Record<string, string | (() => void)>;

      mockCreateElement = vi.fn(() => createdEl);
      mockAppendChild = vi.fn();
      mockRemoveChild = vi.fn();

      vi.stubGlobal("document", {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
      });
      vi.stubGlobal("requestAnimationFrame", (cb: () => void) => cb());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("should create an aria-live element", async () => {
      const { announce } = await import("@/lib/a11y");
      announce("Test message");
      expect(mockCreateElement).toHaveBeenCalledWith("div");
      expect(mockAppendChild).toHaveBeenCalled();
    });

    it("should use assertive priority for alerts", async () => {
      const { announce } = await import("@/lib/a11y");
      announce("Error!", "assertive");
      expect((createdEl.setAttribute as ReturnType<typeof vi.fn>).mock.calls).toEqual(
        expect.arrayContaining([
          ["aria-live", "assertive"],
          ["role", "alert"],
        ]),
      );
    });

    it("should set aria-atomic to true", async () => {
      const { announce } = await import("@/lib/a11y");
      announce("Test");
      expect((createdEl.setAttribute as ReturnType<typeof vi.fn>).mock.calls).toEqual(
        expect.arrayContaining([["aria-atomic", "true"]]),
      );
    });

    it("should auto-remove the element after timeout", async () => {
      const { announce } = await import("@/lib/a11y");
      announce("Test message");
      vi.advanceTimersByTime(5000);
      expect(mockRemoveChild).toHaveBeenCalled();
    });
  });

  describe("prefersReducedMotion", () => {
    it("should return false by default in test env", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn(() => ({ matches: false })),
      });
      expect(prefersReducedMotion()).toBe(false);
      vi.unstubAllGlobals();
    });

    it("should return true when media query matches", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn(() => ({ matches: true })),
      });
      expect(prefersReducedMotion()).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe("prefersHighContrast", () => {
    it("should return false by default", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn(() => ({ matches: false })),
      });
      expect(prefersHighContrast()).toBe(false);
      vi.unstubAllGlobals();
    });

    it("should return true when forced-colors is active", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn((query: string) => ({
          matches: query === "(forced-colors: active)",
        })),
      });
      expect(prefersHighContrast()).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should return true when prefers-contrast is more", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn((query: string) => ({
          matches: query === "(prefers-contrast: more)",
        })),
      });
      expect(prefersHighContrast()).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should return false in SSR (no window)", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error - testing SSR
      delete globalThis.window;
      expect(prefersHighContrast()).toBe(false);
      globalThis.window = origWindow;
    });
  });

  describe("generateAriaId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateAriaId("test");
      const id2 = generateAriaId("test");
      expect(id1).not.toBe(id2);
    });

    it("should use the provided prefix", () => {
      const id = generateAriaId("dialog");
      expect(id).toMatch(/^dialog-\d+$/);
    });

    it("should use default prefix when none provided", () => {
      const id = generateAriaId();
      expect(id).toMatch(/^aria-\d+$/);
    });
  });

  describe("checkContrastRatio", () => {
    it("should calculate correct ratio for black on white", () => {
      const result = checkContrastRatio([0, 0, 0], [255, 255, 255]);
      expect(result.ratio).toBe(21);
      expect(result.passesAAA).toBe(true);
      expect(result.passesAAALarge).toBe(true);
    });

    it("should calculate correct ratio for white on white", () => {
      const result = checkContrastRatio([255, 255, 255], [255, 255, 255]);
      expect(result.ratio).toBe(1);
      expect(result.passesAAA).toBe(false);
      expect(result.passesAAALarge).toBe(false);
    });

    it("should pass AAA for high contrast colors", () => {
      const result = checkContrastRatio([0, 0, 139], [255, 255, 255]);
      expect(result.passesAAA).toBe(true);
    });

    it("should fail AAA for low contrast colors", () => {
      const result = checkContrastRatio([200, 200, 200], [255, 255, 255]);
      expect(result.passesAAA).toBe(false);
    });

    it("should distinguish AAA and AAA Large thresholds", () => {
      const result = checkContrastRatio([100, 100, 100], [255, 255, 255]);
      expect(result.passesAAALarge).toBe(true);
    });
  });

  describe("trapFocus", () => {
    it("should be a function that accepts an HTMLElement", () => {
      expect(typeof trapFocus).toBe("function");
    });

    it("should setup keydown listener and return cleanup", () => {
      const mockFocus = vi.fn();
      const mockAddEventListener = vi.fn();
      const mockRemoveEventListener = vi.fn();
      const focusableEl = { focus: mockFocus };
      const mockQuerySelectorAll = vi.fn(() => [focusableEl]);

      // Stub document globally before calling trapFocus
      const origDoc = globalThis.document;
      Object.defineProperty(globalThis, "document", {
        value: { activeElement: null },
        writable: true,
        configurable: true,
      });

      const container = {
        querySelectorAll: mockQuerySelectorAll,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      } as unknown as HTMLElement;

      const cleanup = trapFocus(container);
      expect(typeof cleanup).toBe("function");
      expect(mockFocus).toHaveBeenCalled();
      expect(mockAddEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
      cleanup();
      expect(mockRemoveEventListener).toHaveBeenCalled();

      // Restore
      Object.defineProperty(globalThis, "document", {
        value: origDoc,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("CSS forced-colors support", () => {
    const css = readFileSync(resolve("src/app/globals.css"), "utf-8");

    it("includes forced-colors media query", () => {
      expect(css).toContain("@media (forced-colors: active)");
    });

    it("adds visible borders to cards in forced-colors", () => {
      expect(css).toContain("[data-slot=\"card\"]");
      expect(css).toContain("ButtonText");
    });

    it("adds visible borders to buttons in forced-colors", () => {
      const forcedSection = css.split("@media (forced-colors: active)")[1] ?? "";
      expect(forcedSection).toContain("button");
    });
  });
});
