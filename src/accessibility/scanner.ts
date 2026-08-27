import type {
  AccessibilityIssue,
  CheckoutAccessibilityConfig,
  FixOption,
  Severity,
} from "../domain/types";
import { contrastRatio } from "./contrast";
import { optionForIssue } from "../proposals/patchCatalog";

export interface AxeEvidence {
  ruleId: string;
  summary: string;
  targets: string[];
}

interface IssueBlueprint {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  componentId: string;
  detectionSource: AccessibilityIssue["detectionSource"];
  autoFixable: boolean;
  requiresHumanReview: boolean;
  isFixed(config: CheckoutAccessibilityConfig): boolean;
  evidence(config: CheckoutAccessibilityConfig): string[];
}

const BLUEPRINTS: IssueBlueprint[] = [
  {
    id: "A11Y-001",
    ruleId: "label",
    title: "Email field has no accessible label",
    description: "The visible Email address text is not programmatically associated with the input.",
    severity: "critical",
    componentId: "checkout-email",
    detectionSource: "axe",
    autoFixable: true,
    requiresHumanReview: false,
    isFixed: (config) => config.emailLabelEnabled,
    evidence: (config) => [
      config.emailLabelEnabled
        ? "The label htmlFor value matches checkout-email."
        : "#checkout-email has no label, aria-label, or aria-labelledby value.",
    ],
  },
  {
    id: "A11Y-002",
    ruleId: "focus-order",
    title: "Focus order skips shipping address",
    description: "The keyboard sequence jumps over the primary shipping-address input.",
    severity: "serious",
    componentId: "shipping-address",
    detectionSource: "custom",
    autoFixable: true,
    requiresHumanReview: false,
    isFixed: (config) => config.focusOrderMode === "correct",
    evidence: (config) => [
      config.focusOrderMode === "correct"
        ? "shipping-address participates in natural document order."
        : "Expected checkout-email → shipping-address; actual sequence skips shipping-address.",
    ],
  },
  {
    id: "A11Y-003",
    ruleId: "keyboard-trap",
    title: "Delivery selector traps keyboard focus",
    description: "Tab is intercepted inside the delivery options and cannot advance normally.",
    severity: "critical",
    componentId: "delivery-options",
    detectionSource: "custom",
    autoFixable: true,
    requiresHumanReview: false,
    isFixed: (config) => !config.deliveryKeyboardTrapEnabled,
    evidence: (config) => [
      config.deliveryKeyboardTrapEnabled
        ? "Bounded replay cannot exit delivery-options with Tab. Escape remains available for demo safety."
        : "Tab exits delivery-options and focus restoration succeeds.",
    ],
  },
  {
    id: "A11Y-004",
    ruleId: "error-announcement",
    title: "Validation error is not announced",
    description: "Payment validation text is visible but not associated or exposed as a live status.",
    severity: "serious",
    componentId: "payment-card",
    detectionSource: "custom",
    autoFixable: true,
    requiresHumanReview: false,
    isFixed: (config) => config.announceValidationErrors,
    evidence: (config) => [
      config.announceValidationErrors
        ? "The card field references payment-error and the error uses role=status."
        : "#payment-error has no live-region role and #payment-card has no aria-describedby.",
    ],
  },
  {
    id: "A11Y-005",
    ruleId: "color-contrast",
    title: "Helper text has insufficient contrast",
    description: "The planted helper token does not meet the deterministic 4.5:1 text target.",
    severity: "moderate",
    componentId: "shipping-helper",
    detectionSource: "axe",
    autoFixable: true,
    requiresHumanReview: false,
    isFixed: (config) => config.helperTextToken === "accessible",
    evidence: (config) => {
      const foreground = config.helperTextToken === "accessible" ? "#52645f" : "#a5afa9";
      return [`Calculated contrast: ${contrastRatio(foreground, "#ffffff").toFixed(2)}:1 (${foreground} on #ffffff).`];
    },
  },
  {
    id: "A11Y-006",
    ruleId: "button-name",
    title: "Final action has an ambiguous name",
    description: "Continue does not communicate that the next action reviews and places the order.",
    severity: "moderate",
    componentId: "continue-action",
    detectionSource: "manual-review",
    autoFixable: false,
    requiresHumanReview: true,
    isFixed: (config) => {
      const value = config.continueAccessibleName?.trim().toLowerCase();
      return Boolean(value && value !== "continue" && value !== "submit");
    },
    evidence: (config) => [
      config.continueAccessibleName
        ? `Resolved accessible name: “${config.continueAccessibleName}”.`
        : "Resolved accessible name: “Continue”; checkout context is not conveyed.",
      "Manual wording review is required before application.",
    ],
  },
];

function publicOption(issueId: string): FixOption[] {
  const patch = optionForIssue(issueId);
  return patch
    ? [
        {
          id: patch.id,
          issueId: patch.issueId,
          label: patch.label,
          description: patch.description,
          risk: patch.risk,
          requiresHumanReview: patch.requiresHumanReview,
        },
      ]
    : [];
}

export function evaluateIssues(
  config: CheckoutAccessibilityConfig,
  checkoutVersion: number,
  scanRunId: string,
  axeEvidence: AxeEvidence[] = [],
): AccessibilityIssue[] {
  return BLUEPRINTS.map((blueprint) => {
    const matchingAxe = axeEvidence.find((item) => item.ruleId === blueprint.ruleId);
    const evidence = blueprint.evidence(config);
    if (matchingAxe) {
      evidence.push(`axe-core: ${matchingAxe.summary} Targets: ${matchingAxe.targets.join(", ")}.`);
    }
    return {
      id: blueprint.id,
      ruleId: blueprint.ruleId,
      title: blueprint.title,
      description: blueprint.description,
      severity: blueprint.severity,
      componentId: blueprint.componentId,
      detectionSource: blueprint.detectionSource,
      evidence,
      autoFixable: blueprint.autoFixable,
      requiresHumanReview: blueprint.requiresHumanReview,
      status: blueprint.isFixed(config) ? "fixed" : "open",
      scanRunId,
      checkoutVersion,
      options: publicOption(blueprint.id),
    };
  });
}

export async function runAxeAdapter(root: Element | Document | null): Promise<AxeEvidence[]> {
  if (!root) return [];
  try {
    const { default: axe } = await import("axe-core");
    const result = await axe.run(root, {
      runOnly: { type: "rule", values: ["label", "color-contrast", "button-name"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((violation) => ({
      ruleId: violation.id,
      summary: violation.help,
      targets: violation.nodes.flatMap((node) => node.target.map(String)).slice(0, 4),
    }));
  } catch {
    return [];
  }
}
