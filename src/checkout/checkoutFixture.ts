import type { CheckoutAccessibilityConfig } from "../domain/types";

export const BASELINE_CONFIG: CheckoutAccessibilityConfig = Object.freeze({
  emailLabelEnabled: false,
  focusOrderMode: "broken",
  deliveryKeyboardTrapEnabled: true,
  announceValidationErrors: false,
  helperTextToken: "low-contrast",
  continueAccessibleName: null,
});

export const SYNTHETIC_CHECKOUT = Object.freeze({
  customer: {
    name: "Jordan Lee",
    email: "jordan.lee@example.test",
    address: "1847 Cedar Lane",
    city: "Madison",
    region: "WI",
    postalCode: "53703",
  },
  order: {
    item: "Everyday Canvas Tote",
    quantity: 1,
    subtotal: "$48.00",
    shipping: "$5.00",
    total: "$53.00",
  },
});

export function cloneBaselineConfig(): CheckoutAccessibilityConfig {
  return { ...BASELINE_CONFIG };
}
