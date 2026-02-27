// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHighContrast } from "@/lib/a11y/use-high-contrast";

describe("useHighContrast", () => {
  function createMockMatchMedia(matches: boolean) {
    return {
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }

  let origMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    origMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = origMatchMedia;
    vi.restoreAllMocks();
  });

  it("returns false when no high contrast preference", () => {
    const mockMQ = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mockMQ) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useHighContrast());
    expect(result.current).toBe(false);
  });

  it("returns true when forced-colors is active", () => {
    window.matchMedia = vi.fn((query: string) =>
      createMockMatchMedia(query === "(forced-colors: active)"),
    ) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useHighContrast());
    expect(result.current).toBe(true);
  });

  it("returns true when prefers-contrast is more", () => {
    window.matchMedia = vi.fn((query: string) =>
      createMockMatchMedia(query === "(prefers-contrast: more)"),
    ) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useHighContrast());
    expect(result.current).toBe(true);
  });

  it("registers change event listeners", () => {
    const mockMQ = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mockMQ) as unknown as typeof window.matchMedia;
    renderHook(() => useHighContrast());
    expect(mockMQ.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("cleans up listeners on unmount", () => {
    const mockMQ = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mockMQ) as unknown as typeof window.matchMedia;
    const { unmount } = renderHook(() => useHighContrast());
    unmount();
    expect(mockMQ.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
