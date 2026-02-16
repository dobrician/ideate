// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { useCommentPoll } from "@/lib/use-comment-poll";

describe("useCommentPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls router.refresh on interval", () => {
    renderHook(() => useCommentPoll(5000));
    expect(mockRefresh).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("uses default 15s interval", () => {
    renderHook(() => useCommentPoll());
    act(() => { vi.advanceTimersByTime(14_999); });
    expect(mockRefresh).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("stops polling when tab becomes hidden", () => {
    renderHook(() => useCommentPoll(5000));

    // Tab goes hidden
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Advance — should NOT refresh
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(mockRefresh).not.toHaveBeenCalled();

    // Restore
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  it("resumes polling and refreshes when tab becomes visible", () => {
    renderHook(() => useCommentPoll(5000));

    // Tab goes hidden
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Tab becomes visible again
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Immediate refresh on visibility change
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Polling should resume
    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("cleans up interval on unmount", () => {
    const { unmount } = renderHook(() => useCommentPoll(5000));
    unmount();

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("removes visibilitychange listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useCommentPoll(5000));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    removeSpy.mockRestore();
  });
});
