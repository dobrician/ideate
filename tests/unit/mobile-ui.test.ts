import { describe, it, expect } from "vitest";
import { detectSwipe, validateTouchTarget, isWithinTouchTarget, type SwipeDirection } from "@/lib/gestures";

describe("Mobile UI - Gestures", () => {
  describe("detectSwipe", () => {
    it("should detect right swipe", () => {
      const result = detectSwipe(0, 100, 200, 100, 200);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe("right");
    });

    it("should detect left swipe", () => {
      const result = detectSwipe(200, 100, 0, 100, 200);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe("left");
    });

    it("should detect down swipe", () => {
      const result = detectSwipe(100, 0, 100, 200, 200);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe("down");
    });

    it("should detect up swipe", () => {
      const result = detectSwipe(100, 200, 100, 0, 200);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe("up");
    });

    it("should return null for short swipes below threshold", () => {
      const result = detectSwipe(0, 0, 10, 10, 100);
      expect(result).toBeNull();
    });

    it("should return null for slow swipes below velocity threshold", () => {
      const result = detectSwipe(0, 0, 60, 0, 100000);
      expect(result).toBeNull();
    });

    it("should respect allowed directions filter", () => {
      const result = detectSwipe(0, 100, 200, 100, 200, {
        allowedDirections: ["up", "down"],
      });
      expect(result).toBeNull();
    });

    it("should calculate correct distance", () => {
      const result = detectSwipe(0, 0, 300, 0, 200);
      expect(result).not.toBeNull();
      expect(result!.distance).toBe(300);
    });

    it("should calculate correct velocity", () => {
      const result = detectSwipe(0, 0, 300, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.velocity).toBe(3);
    });

    it("should use custom threshold", () => {
      const result = detectSwipe(0, 0, 80, 0, 100, { threshold: 100 });
      expect(result).toBeNull();
    });
  });

  describe("validateTouchTarget", () => {
    it("should validate a 44x44 element as valid", () => {
      const el = { getBoundingClientRect: () => ({ width: 44, height: 44, left: 0, top: 0, right: 44, bottom: 44 }) } as HTMLElement;
      const result = validateTouchTarget(el);
      expect(result.valid).toBe(true);
    });

    it("should validate a small element as invalid", () => {
      const el = { getBoundingClientRect: () => ({ width: 20, height: 20, left: 0, top: 0, right: 20, bottom: 20 }) } as HTMLElement;
      const result = validateTouchTarget(el);
      expect(result.valid).toBe(false);
    });

    it("should return actual dimensions", () => {
      const el = { getBoundingClientRect: () => ({ width: 60, height: 30, left: 0, top: 0, right: 60, bottom: 30 }) } as HTMLElement;
      const result = validateTouchTarget(el);
      expect(result.width).toBe(60);
      expect(result.height).toBe(30);
      expect(result.valid).toBe(false);
    });
  });

  describe("isWithinTouchTarget", () => {
    it("should return true when point is within bounds", () => {
      const rect = { left: 10, top: 10, right: 60, bottom: 60, width: 50, height: 50 } as DOMRect;
      expect(isWithinTouchTarget(30, 30, rect)).toBe(true);
    });

    it("should return false when point is outside bounds", () => {
      const rect = { left: 10, top: 10, right: 60, bottom: 60, width: 50, height: 50 } as DOMRect;
      expect(isWithinTouchTarget(100, 100, rect)).toBe(false);
    });

    it("should pad small targets to minimum 44px", () => {
      const rect = { left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 } as DOMRect;
      // Point just outside the 20px rect but within 44px padded area
      expect(isWithinTouchTarget(5, 20, rect, 44)).toBe(true);
    });

    it("should not pad targets already meeting minimum", () => {
      const rect = { left: 10, top: 10, right: 60, bottom: 60, width: 50, height: 50 } as DOMRect;
      expect(isWithinTouchTarget(5, 30, rect, 44)).toBe(false);
    });
  });
});
