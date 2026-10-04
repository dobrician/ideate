import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Calculate text contrast for the approved opaque semantic color pairs. */
function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

describe("DecisionPalette", () => {
  const css = readFileSync("src/app/decision-palette.css", "utf8");
  for (const [theme, block] of [["light", css.split(".dark")[0]], ["dark", css.split(".dark")[1]?.split("@theme")[0]]] as const) {
    for (const role of ["vote-pro", "vote-contra", "chat-own"]) {
      it(`should keep ${role} text above 4.5:1 in ${theme}`, () => {
        const surface = block!.match(new RegExp(`--${role}: (#[A-F\\d]+)`))![1]!;
        const ink = block!.match(new RegExp(`--${role}-foreground: (#[A-F\\d]+)`))![1]!;
        const a = luminance(surface), b = luminance(ink);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
