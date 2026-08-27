import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "../../src/accessibility/contrast";

describe("contrast calculator", () => {
  it("computes canonical black and white luminance", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("separates the planted low-contrast and accessible tokens", () => {
    expect(contrastRatio("#a5afa9", "#ffffff")).toBeLessThan(4.5);
    expect(contrastRatio("#52645f", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects malformed colors", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow(/Invalid six-digit hex color/);
  });
});
