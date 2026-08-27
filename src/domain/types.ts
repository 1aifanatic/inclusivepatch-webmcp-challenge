export type WorkspacePhase =
  | "BASELINE"
  | "SCANNED"
  | "PROPOSALS_STAGED"
  | "HUMAN_REVIEW"
  | "READY_TO_APPLY"
  | "APPLIED"
  | "VERIFIED";

export type Actor = "human" | "agent" | "system";
export type Severity = "critical" | "serious" | "moderate" | "minor";
export type IssueStatus = "open" | "staged" | "fixed" | "dismissed";
export type ProposalStatus = "pending" | "approved" | "rejected" | "stale" | "applied";

export interface CheckoutAccessibilityConfig {
  emailLabelEnabled: boolean;
  focusOrderMode: "broken" | "correct";
  deliveryKeyboardTrapEnabled: boolean;
  announceValidationErrors: boolean;
  helperTextToken: "low-contrast" | "accessible";
  continueAccessibleName: string | null;
}

export interface FixOption {
  id: string;
  issueId: string;
  label: string;
  description: string;
  risk: "low" | "medium";
  requiresHumanReview: boolean;
}

export interface AccessibilityIssue {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  componentId: string;
  detectionSource: "axe" | "custom" | "manual-review";
  evidence: string[];
  autoFixable: boolean;
  requiresHumanReview: boolean;
  status: IssueStatus;
  scanRunId: string;
  checkoutVersion: number;
  options: FixOption[];
}

export interface FixProposal {
  id: string;
  issueId: string;
  optionId: string;
  beforeValue: unknown;
  proposedValue: unknown;
  rationale: string;
  risk: "low" | "medium";
  status: ProposalStatus;
  rejectionReason: string | null;
  createdBy: "human" | "agent";
  checkoutVersion: number;
  supersedesProposalId: string | null;
}

export interface JourneyEvent {
  stepId: string;
  label: string;
  expected: string;
  actual: string;
  status: "passed" | "failed" | "skipped";
}

export interface JourneyRun {
  id: string;
  journeyId: "checkout-keyboard";
  checkoutVersion: number;
  status: "running" | "passed" | "failed" | "cancelled";
  failureStep: string | null;
  events: JourneyEvent[];
  startedAt: string;
  completedAt: string | null;
}

export interface ActivityRecord {
  id: string;
  timestamp: string;
  actor: Actor;
  action: string;
  toolName: string | null;
  inputSummary: string;
  result: "success" | "rejected" | "cancelled";
  changedIds: string[];
  checkoutVersion: number;
  workspacePhase: WorkspacePhase;
}

export interface AppliedBatch {
  id: string;
  proposalIds: string[];
  before: CheckoutAccessibilityConfig;
  after: CheckoutAccessibilityConfig;
  appliedAtVersion: number;
}

export interface WorkspaceState {
  schemaVersion: 1;
  phase: WorkspacePhase;
  checkoutVersion: number;
  config: CheckoutAccessibilityConfig;
  issues: AccessibilityIssue[];
  proposals: FixProposal[];
  journey: JourneyRun | null;
  baselineJourney: JourneyRun | null;
  activity: ActivityRecord[];
  selectedIssueId: string | null;
  selectedComponentId: string | null;
  appliedHistory: AppliedBatch[];
  sequence: number;
}

export interface VersionComparison {
  baselineVersion: 1;
  currentVersion: number;
  baselineIssueCount: 6;
  currentOpenIssueCount: number;
  fixedIssueIds: string[];
  baselineJourneyStatus: "failed" | "not-run";
  currentJourneyStatus: JourneyRun["status"] | "not-run";
  currentJourneyFailureStep: string | null;
  proposalCounts: Record<ProposalStatus, number>;
}

export interface ToolResult<T> {
  ok: boolean;
  code: string | null;
  message: string;
  workspacePhase: WorkspacePhase;
  checkoutVersion: number;
  changedIds: string[];
  data: T;
  nextRecommendedActions: string[];
}
