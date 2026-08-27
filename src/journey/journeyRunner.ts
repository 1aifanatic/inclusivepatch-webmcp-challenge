import type { CheckoutAccessibilityConfig, JourneyEvent } from "../domain/types";

function event(
  stepId: string,
  label: string,
  expected: string,
  actual: string,
  passes: boolean,
): JourneyEvent {
  return { stepId, label, expected, actual, status: passes ? "passed" : "failed" };
}

export function buildJourneyEvents(config: CheckoutAccessibilityConfig): JourneyEvent[] {
  const contextualName = config.continueAccessibleName?.trim() ?? "Continue";
  const contextualNamePasses = !["continue", "submit"].includes(contextualName.toLowerCase());
  const events = [
    event(
      "01-email-name",
      "Focus email field",
      "Accessible name is Email address",
      config.emailLabelEnabled ? "Email address" : "No accessible name",
      config.emailLabelEnabled,
    ),
    event("02-enter-email", "Enter synthetic email", "Value accepted", "jordan.lee@example.test accepted", true),
    event(
      "03-focus-order",
      "Tab to shipping address",
      "Focus reaches shipping address",
      config.focusOrderMode === "correct" ? "shipping-address" : "delivery-options",
      config.focusOrderMode === "correct",
    ),
    event("04-shipping-fields", "Complete shipping fields", "Required fields populated", "Synthetic address populated", true),
    event("05-open-delivery", "Open delivery selector", "Selector opens with keyboard", "Selector opened", true),
    event("06-delivery-option", "Navigate delivery options", "Arrow keys change option", "Standard delivery selected", true),
    event(
      "07-exit-delivery",
      "Exit delivery selector",
      "Tab moves to payment details",
      config.deliveryKeyboardTrapEnabled ? "Focus remained trapped" : "Focus moved to payment details",
      !config.deliveryKeyboardTrapEnabled,
    ),
    event("08-trigger-validation", "Continue without payment", "Validation is triggered", "Payment error displayed", true),
    event(
      "09-error-announcement",
      "Verify error announcement",
      "Error is associated and announced",
      config.announceValidationErrors ? "payment-error announced" : "Visual-only error",
      config.announceValidationErrors,
    ),
    event(
      "10-final-action-name",
      "Inspect final action name",
      "Contextual order action",
      contextualName,
      contextualNamePasses,
    ),
  ];
  const allPassed = events.every((item) => item.status === "passed");
  events.push(
    event(
      "11-record-outcome",
      "Record journey outcome",
      "All assertions pass",
      allPassed ? "All assertions passed" : "One or more assertions failed",
      allPassed,
    ),
  );
  return events;
}
