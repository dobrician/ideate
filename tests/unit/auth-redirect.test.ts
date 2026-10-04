import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "@/lib/auth-redirect";

describe("AuthRedirect", () => {
  it("should preserve the shared-project destination", () => {
    expect(getSafeRedirect("/p/demo?sort=votes")).toBe("/p/demo?sort=votes");
  });
  it.each([null, "", "https://external.invalid", "//external.invalid", "/\\external.invalid", "/\t/external.invalid", "/\n/external.invalid"])(
    "should return home when the destination is unsafe: %s", (value) => {
      expect(getSafeRedirect(value)).toBe("/");
    },
  );
});
