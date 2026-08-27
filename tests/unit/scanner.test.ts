import { describe, expect, it } from "vitest";
import { evaluateIssues } from "../../src/accessibility/scanner";
import { cloneBaselineConfig } from "../../src/checkout/checkoutFixture";

describe("deterministic accessibility scanner", () => {
  it("finds exactly all six planted barriers on every baseline scan", () => {
    const first = evaluateIssues(cloneBaselineConfig(), 1, "SCAN-1");
    const second = evaluateIssues(cloneBaselineConfig(), 1, "SCAN-2");
    expect(first).toHaveLength(6);
    expect(first.map((issue) => issue.id)).toEqual(second.map((issue) => issue.id));
    expect(first.every((issue) => issue.status === "open")).toBe(true);
    expect(first.filter((issue) => issue.requiresHumanReview).map((issue) => issue.id)).toEqual(["A11Y-006"]);
  });

  it("marks all six fixed when the typed configuration is remediated", () => {
    const issues = evaluateIssues(
      {
        emailLabelEnabled: true,
        focusOrderMode: "correct",
        deliveryKeyboardTrapEnabled: false,
        announceValidationErrors: true,
        helperTextToken: "accessible",
        continueAccessibleName: "Review and place order",
      },
      2,
      "SCAN-2",
    );
    expect(issues.filter((issue) => issue.status === "fixed")).toHaveLength(6);
  });
});
