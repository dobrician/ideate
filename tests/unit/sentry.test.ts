import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: { setExtras: ReturnType<typeof vi.fn> }) => void) => {
    cb({ setExtras: vi.fn() });
  }),
}));

import * as Sentry from "@sentry/nextjs";
import { captureError } from "@/lib/sentry";

describe("captureError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Sentry.captureException with the error", () => {
    const err = new Error("test error");
    captureError(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("passes context via withScope when provided", () => {
    const err = new Error("context error");
    const ctx = { route: "POST /api/test" };
    captureError(err, ctx);
    expect(Sentry.withScope).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("handles non-Error values", () => {
    captureError("string error");
    expect(Sentry.captureException).toHaveBeenCalledWith("string error");
  });
});
