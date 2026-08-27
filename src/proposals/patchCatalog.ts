import type { CheckoutAccessibilityConfig, FixOption } from "../domain/types";

export type PatchValue = boolean | "correct" | "accessible" | string;

export interface PatchDefinition extends FixOption {
  rationale: string;
  read(config: CheckoutAccessibilityConfig): unknown;
  propose(proposedText?: string): PatchValue;
  validate(value: unknown): boolean;
  apply(config: CheckoutAccessibilityConfig, value: PatchValue): CheckoutAccessibilityConfig;
}

function cleanText(value: string): string {
  return value.replace(/[<>\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export const PATCH_CATALOG: Record<string, PatchDefinition> = {
  add_email_label: {
    id: "add_email_label",
    issueId: "A11Y-001",
    label: "Associate the visible email label",
    description: "Connect the existing Email address text to the email input.",
    risk: "low",
    requiresHumanReview: false,
    rationale: "Provides a deterministic accessible name without changing the visual layout.",
    read: (config) => config.emailLabelEnabled,
    propose: () => true,
    validate: (value) => value === true,
    apply: (config) => ({ ...config, emailLabelEnabled: true }),
  },
  restore_focus_order: {
    id: "restore_focus_order",
    issueId: "A11Y-002",
    label: "Restore expected focus order",
    description: "Return the shipping address field to the natural tab sequence.",
    risk: "low",
    requiresHumanReview: false,
    rationale: "Makes keyboard navigation follow the visual and semantic order.",
    read: (config) => config.focusOrderMode,
    propose: () => "correct",
    validate: (value) => value === "correct",
    apply: (config) => ({ ...config, focusOrderMode: "correct" }),
  },
  remove_delivery_trap: {
    id: "remove_delivery_trap",
    issueId: "A11Y-003",
    label: "Allow focus to leave delivery options",
    description: "Remove the demo trap while preserving arrow-key option selection.",
    risk: "low",
    requiresHumanReview: false,
    rationale: "Restores predictable Tab and Shift+Tab behavior in the selector.",
    read: (config) => config.deliveryKeyboardTrapEnabled,
    propose: () => false,
    validate: (value) => value === false,
    apply: (config) => ({ ...config, deliveryKeyboardTrapEnabled: false }),
  },
  announce_validation_errors: {
    id: "announce_validation_errors",
    issueId: "A11Y-004",
    label: "Associate and announce validation errors",
    description: "Wire the payment error to the control and a polite live region.",
    risk: "low",
    requiresHumanReview: false,
    rationale: "Makes validation feedback available without requiring visual discovery.",
    read: (config) => config.announceValidationErrors,
    propose: () => true,
    validate: (value) => value === true,
    apply: (config) => ({ ...config, announceValidationErrors: true }),
  },
  upgrade_helper_contrast: {
    id: "upgrade_helper_contrast",
    issueId: "A11Y-005",
    label: "Use the accessible helper text token",
    description: "Replace the low-contrast helper color with the tested text token.",
    risk: "low",
    requiresHumanReview: false,
    rationale: "Raises the deterministic contrast ratio above 4.5:1.",
    read: (config) => config.helperTextToken,
    propose: () => "accessible",
    validate: (value) => value === "accessible",
    apply: (config) => ({ ...config, helperTextToken: "accessible" }),
  },
  name_final_action: {
    id: "name_final_action",
    issueId: "A11Y-006",
    label: "Add a contextual final-action name",
    description: "Keep the visible label while supplying reviewed assistive wording.",
    risk: "medium",
    requiresHumanReview: true,
    rationale: "The wording changes user-facing meaning and therefore needs human judgment.",
    read: (config) => config.continueAccessibleName,
    propose: (proposedText) => cleanText(proposedText ?? "Submit"),
    validate: (value) => typeof value === "string" && value.length >= 2 && value.length <= 120,
    apply: (config, value) => ({ ...config, continueAccessibleName: String(value) }),
  },
};

export function optionForIssue(issueId: string): PatchDefinition | null {
  return Object.values(PATCH_CATALOG).find((patch) => patch.issueId === issueId) ?? null;
}
