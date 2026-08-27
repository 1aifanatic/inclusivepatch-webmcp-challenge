import { describe, expect, it } from "vitest";
import { cloneBaselineConfig } from "../../src/checkout/checkoutFixture";
import { buildJourneyEvents } from "../../src/journey/journeyRunner";

describe("keyboard journey runner", () => {
  it("fails the exact baseline deterministically", () => {
    const events = buildJourneyEvents(cloneBaselineConfig());
    expect(events).toHaveLength(11);
    expect(events.some((event) => event.status === "failed")).toBe(true);
    expect(events.find((event) => event.stepId === "07-exit-delivery")?.status).toBe("failed");
  });

  it("passes every assertion after all required remediations", () => {
    const events = buildJourneyEvents({
      emailLabelEnabled: true,
      focusOrderMode: "correct",
      deliveryKeyboardTrapEnabled: false,
      announceValidationErrors: true,
      helperTextToken: "accessible",
      continueAccessibleName: "Review and place order",
    });
    expect(events.every((event) => event.status === "passed")).toBe(true);
  });
});
