import { cloneBaselineConfig } from "../checkout/checkoutFixture";
import { evaluateIssues, type AxeEvidence } from "../accessibility/scanner";
import { PATCH_CATALOG } from "../proposals/patchCatalog";
import type {
  Actor,
  ActivityRecord,
  FixProposal,
  JourneyEvent,
  JourneyRun,
  ProposalStatus,
  VersionComparison,
  WorkspacePhase,
  WorkspaceState,
} from "./types";

export type DomainErrorCode =
  | "WEBMCP_UNAVAILABLE"
  | "INVALID_INPUT"
  | "ISSUE_NOT_FOUND"
  | "OPTION_NOT_ALLOWED"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_NOT_APPROVED"
  | "STALE_PROPOSAL"
  | "NO_APPROVED_PROPOSALS"
  | "JOURNEY_ALREADY_RUNNING"
  | "VERSION_NOT_FOUND"
  | "NOTHING_TO_UNDO"
  | "EXPORT_FAILED";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

interface ActivityInput {
  actor: Actor;
  action: string;
  toolName?: string;
  inputSummary: string;
  result?: ActivityRecord["result"];
  changedIds: string[];
}

function phaseFor(state: WorkspaceState): WorkspacePhase {
  if (state.journey?.status === "passed" && state.journey.checkoutVersion === state.checkoutVersion) {
    return "VERIFIED";
  }
  const currentProposals = state.proposals.filter(
    (proposal) => proposal.checkoutVersion === state.checkoutVersion,
  );
  if (currentProposals.some((proposal) => proposal.status === "pending")) {
    return currentProposals.length === 1 && !currentProposals[0]?.risk.includes("medium")
      ? "PROPOSALS_STAGED"
      : "HUMAN_REVIEW";
  }
  if (currentProposals.some((proposal) => proposal.status === "approved")) {
    return "READY_TO_APPLY";
  }
  if (state.appliedHistory.length > 0 || state.checkoutVersion > 1) return "APPLIED";
  if (state.issues.length > 0) return "SCANNED";
  return "BASELINE";
}

function withActivity(state: WorkspaceState, input: ActivityInput): WorkspaceState {
  const sequence = state.sequence + 1;
  const phase = phaseFor(state);
  const record: ActivityRecord = {
    id: `ACT-${String(sequence).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
    actor: input.actor,
    action: input.action,
    toolName: input.toolName ?? null,
    inputSummary: input.inputSummary,
    result: input.result ?? "success",
    changedIds: input.changedIds,
    checkoutVersion: state.checkoutVersion,
    workspacePhase: phase,
  };
  return { ...state, phase, sequence, activity: [...state.activity, record] };
}

export function recordActivity(state: WorkspaceState, input: ActivityInput): WorkspaceState {
  return withActivity(state, input);
}

export function createInitialWorkspaceState(): WorkspaceState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    phase: "BASELINE",
    checkoutVersion: 1,
    config: cloneBaselineConfig(),
    issues: [],
    proposals: [],
    journey: null,
    baselineJourney: null,
    activity: [
      {
        id: "ACT-001",
        timestamp: now,
        actor: "system",
        action: "Reset demo",
        toolName: null,
        inputSummary: "Exact baseline fixture restored",
        result: "success",
        changedIds: ["checkout", "workspace"],
        checkoutVersion: 1,
        workspacePhase: "BASELINE",
      },
    ],
    selectedIssueId: null,
    selectedComponentId: null,
    appliedHistory: [],
    sequence: 1,
  };
}

export function scanWorkspace(
  state: WorkspaceState,
  actor: Actor,
  toolName: string | undefined,
  axeEvidence: AxeEvidence[] = [],
): WorkspaceState {
  const scanRunId = `SCAN-v${state.checkoutVersion}-${state.sequence + 1}`;
  const issues = evaluateIssues(state.config, state.checkoutVersion, scanRunId, axeEvidence);
  const openCount = issues.filter((issue) => issue.status === "open").length;
  return withActivity(
    { ...state, issues, selectedIssueId: null, selectedComponentId: null },
    {
      actor,
      action: "Scan checkout",
      ...(toolName ? { toolName } : {}),
      inputSummary: `Fixture scan at version ${state.checkoutVersion}`,
      changedIds: [scanRunId, ...issues.map((issue) => issue.id)],
      result: "success",
    },
  );
}

export function selectIssue(state: WorkspaceState, issueId: string): WorkspaceState {
  const issue = state.issues.find((candidate) => candidate.id === issueId);
  if (!issue) throw new DomainError("ISSUE_NOT_FOUND", `Issue ${issueId} was not found in the current scan.`);
  return { ...state, selectedIssueId: issue.id, selectedComponentId: issue.componentId };
}

export function stageProposal(
  state: WorkspaceState,
  input: { issueId: string; optionId: string; proposedText?: string },
  actor: "human" | "agent",
  toolName?: string,
): WorkspaceState {
  const issue = state.issues.find((candidate) => candidate.id === input.issueId);
  if (!issue || issue.status === "fixed") {
    throw new DomainError("ISSUE_NOT_FOUND", `Open issue ${input.issueId} was not found at version ${state.checkoutVersion}.`);
  }
  const patch = PATCH_CATALOG[input.optionId];
  if (!patch || patch.issueId !== issue.id) {
    throw new DomainError("OPTION_NOT_ALLOWED", `Option ${input.optionId} does not belong to ${input.issueId}.`);
  }
  const duplicate = state.proposals.find(
    (proposal) =>
      proposal.issueId === issue.id &&
      proposal.checkoutVersion === state.checkoutVersion &&
      ["pending", "approved"].includes(proposal.status),
  );
  if (duplicate) {
    throw new DomainError("INVALID_INPUT", `${issue.id} already has current proposal ${duplicate.id}.`);
  }
  const proposedValue = patch.propose(input.proposedText);
  if (!patch.validate(proposedValue)) {
    throw new DomainError("INVALID_INPUT", `The proposed value for ${input.optionId} is invalid.`);
  }
  const previousRejected = [...state.proposals]
    .reverse()
    .find((proposal) => proposal.issueId === issue.id && proposal.status === "rejected");
  const proposalSequence = state.proposals.length + 1;
  const proposal: FixProposal = {
    id: `PROP-${String(proposalSequence).padStart(3, "0")}`,
    issueId: issue.id,
    optionId: patch.id,
    beforeValue: patch.read(state.config),
    proposedValue,
    rationale: patch.rationale,
    risk: patch.risk,
    status: "pending",
    rejectionReason: null,
    createdBy: actor,
    checkoutVersion: state.checkoutVersion,
    supersedesProposalId: previousRejected?.id ?? null,
  };
  const issues = state.issues.map((candidate) =>
    candidate.id === issue.id ? { ...candidate, status: "staged" as const } : candidate,
  );
  return withActivity(
    { ...state, issues, proposals: [...state.proposals, proposal], selectedIssueId: issue.id, selectedComponentId: issue.componentId },
    {
      actor,
      action: previousRejected ? "Revise proposal" : "Stage proposal",
      ...(toolName ? { toolName } : {}),
      inputSummary: `${issue.id} → ${patch.id}${previousRejected ? `; supersedes ${previousRejected.id}` : ""}`,
      changedIds: [proposal.id, issue.id],
    },
  );
}

export function approveProposal(
  state: WorkspaceState,
  proposalId: string,
  actor: "human" = "human",
): WorkspaceState {
  const proposal = state.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) throw new DomainError("PROPOSAL_NOT_FOUND", `Proposal ${proposalId} was not found.`);
  if (proposal.checkoutVersion !== state.checkoutVersion) {
    throw new DomainError("STALE_PROPOSAL", `${proposalId} belongs to version ${proposal.checkoutVersion}; current is ${state.checkoutVersion}.`);
  }
  if (proposal.status !== "pending") {
    throw new DomainError("INVALID_INPUT", `${proposalId} cannot be approved from status ${proposal.status}.`);
  }
  const proposals = state.proposals.map((candidate) =>
    candidate.id === proposalId ? { ...candidate, status: "approved" as const } : candidate,
  );
  return withActivity(
    { ...state, proposals },
    { actor, action: "Approve proposal", inputSummary: proposalId, changedIds: [proposalId] },
  );
}

export function rejectProposal(
  state: WorkspaceState,
  proposalId: string,
  reason: string,
  actor: "human" = "human",
): WorkspaceState {
  const proposal = state.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) throw new DomainError("PROPOSAL_NOT_FOUND", `Proposal ${proposalId} was not found.`);
  const cleanReason = reason.replace(/[<>\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!cleanReason) throw new DomainError("INVALID_INPUT", "A rejection reason is required.");
  if (proposal.checkoutVersion !== state.checkoutVersion) {
    throw new DomainError("STALE_PROPOSAL", `${proposalId} is stale and cannot be rejected.`);
  }
  if (!(["pending", "approved"] as ProposalStatus[]).includes(proposal.status)) {
    throw new DomainError("INVALID_INPUT", `${proposalId} cannot be rejected from status ${proposal.status}.`);
  }
  const proposals = state.proposals.map((candidate) =>
    candidate.id === proposalId
      ? { ...candidate, status: "rejected" as const, rejectionReason: cleanReason }
      : candidate,
  );
  const issues = state.issues.map((issue) =>
    issue.id === proposal.issueId ? { ...issue, status: "open" as const } : issue,
  );
  return withActivity(
    { ...state, proposals, issues },
    {
      actor,
      action: "Reject proposal",
      inputSummary: `${proposalId}: ${cleanReason}`,
      result: "rejected",
      changedIds: [proposalId, proposal.issueId],
    },
  );
}

export function applyApprovedProposals(
  state: WorkspaceState,
  proposalIds: string[],
  actor: Actor,
  toolName?: string,
): WorkspaceState {
  const uniqueIds = [...new Set(proposalIds)];
  if (uniqueIds.length === 0) {
    throw new DomainError("NO_APPROVED_PROPOSALS", "Select at least one approved proposal to apply.");
  }
  if (uniqueIds.length !== proposalIds.length) {
    throw new DomainError("INVALID_INPUT", "Duplicate proposal IDs are not allowed.");
  }
  const selected = uniqueIds.map((id) => {
    const proposal = state.proposals.find((candidate) => candidate.id === id);
    if (!proposal) throw new DomainError("PROPOSAL_NOT_FOUND", `Proposal ${id} was not found.`);
    if (proposal.checkoutVersion !== state.checkoutVersion) {
      throw new DomainError(
        "STALE_PROPOSAL",
        `Proposal ${id} was created for version ${proposal.checkoutVersion}, but current version is ${state.checkoutVersion}.`,
      );
    }
    if (proposal.status !== "approved") {
      throw new DomainError("PROPOSAL_NOT_APPROVED", `Proposal ${id} has status ${proposal.status}.`);
    }
    const issue = state.issues.find((candidate) => candidate.id === proposal.issueId);
    if (!issue || issue.status === "fixed") {
      throw new DomainError("ISSUE_NOT_FOUND", `Issue ${proposal.issueId} is no longer open.`);
    }
    const patch = PATCH_CATALOG[proposal.optionId];
    if (!patch || patch.issueId !== proposal.issueId || !patch.validate(proposal.proposedValue)) {
      throw new DomainError("OPTION_NOT_ALLOWED", `Proposal ${id} no longer maps to a valid patch.`);
    }
    return { proposal, patch };
  });
  let config = { ...state.config };
  for (const { proposal, patch } of selected) config = patch.apply(config, proposal.proposedValue as never);
  const checkoutVersion = state.checkoutVersion + 1;
  const selectedSet = new Set(uniqueIds);
  const proposals = state.proposals.map((proposal) => {
    if (selectedSet.has(proposal.id)) return { ...proposal, status: "applied" as const };
    if (proposal.checkoutVersion === state.checkoutVersion && ["pending", "approved"].includes(proposal.status)) {
      return { ...proposal, status: "stale" as const };
    }
    return proposal;
  });
  const issues = evaluateIssues(config, checkoutVersion, `APPLY-v${checkoutVersion}`);
  const batchId = `BATCH-v${checkoutVersion}`;
  const nextState: WorkspaceState = {
    ...state,
    checkoutVersion,
    config,
    proposals,
    issues,
    journey: null,
    selectedIssueId: null,
    selectedComponentId: null,
    appliedHistory: [
      ...state.appliedHistory,
      {
        id: batchId,
        proposalIds: uniqueIds,
        before: { ...state.config },
        after: { ...config },
        appliedAtVersion: checkoutVersion,
      },
    ],
  };
  return withActivity(nextState, {
    actor,
    action: "Apply approved fixes",
    ...(toolName ? { toolName } : {}),
    inputSummary: uniqueIds.join(", "),
    changedIds: [batchId, ...uniqueIds, ...selected.map(({ proposal }) => proposal.issueId)],
  });
}

export function undoLastAppliedFix(state: WorkspaceState, actor: Actor, toolName?: string): WorkspaceState {
  const batch = state.appliedHistory.at(-1);
  if (!batch) throw new DomainError("NOTHING_TO_UNDO", "There is no applied remediation batch to undo.");
  const checkoutVersion = state.checkoutVersion + 1;
  const issues = evaluateIssues(batch.before, checkoutVersion, `UNDO-v${checkoutVersion}`);
  const nextState: WorkspaceState = {
    ...state,
    checkoutVersion,
    config: { ...batch.before },
    issues,
    proposals: state.proposals.map((proposal) =>
      proposal.status === "applied" && batch.proposalIds.includes(proposal.id)
        ? { ...proposal, status: "stale" as const }
        : proposal,
    ),
    journey: null,
    appliedHistory: state.appliedHistory.slice(0, -1),
  };
  return withActivity(nextState, {
    actor,
    action: "Undo latest applied fix",
    ...(toolName ? { toolName } : {}),
    inputSummary: batch.id,
    changedIds: [batch.id, ...batch.proposalIds],
  });
}

export function startJourney(state: WorkspaceState): WorkspaceState {
  if (state.journey?.status === "running") {
    throw new DomainError("JOURNEY_ALREADY_RUNNING", "The checkout keyboard journey is already running.");
  }
  const run: JourneyRun = {
    id: `JRNY-v${state.checkoutVersion}-${state.sequence + 1}`,
    journeyId: "checkout-keyboard",
    checkoutVersion: state.checkoutVersion,
    status: "running",
    failureStep: null,
    events: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  return { ...state, journey: run };
}

export function appendJourneyEvent(state: WorkspaceState, journeyEvent: JourneyEvent): WorkspaceState {
  if (!state.journey || state.journey.status !== "running") return state;
  return { ...state, journey: { ...state.journey, events: [...state.journey.events, journeyEvent] } };
}

export function finishJourney(
  state: WorkspaceState,
  status: "passed" | "failed" | "cancelled",
  actor: Actor,
  toolName?: string,
): WorkspaceState {
  if (!state.journey) throw new DomainError("INVALID_INPUT", "No journey run exists.");
  const failureStep = state.journey.events.find((event) => event.status === "failed")?.stepId ?? null;
  const journey: JourneyRun = {
    ...state.journey,
    status,
    failureStep: status === "failed" ? failureStep : null,
    completedAt: new Date().toISOString(),
  };
  const baselineJourney =
    state.checkoutVersion === 1 && !state.baselineJourney ? journey : state.baselineJourney;
  return withActivity(
    { ...state, journey, baselineJourney },
    {
      actor,
      action: status === "cancelled" ? "Cancel keyboard journey" : "Replay keyboard journey",
      ...(toolName ? { toolName } : {}),
      inputSummary: `${journey.id}: ${status}`,
      result: status === "cancelled" ? "cancelled" : "success",
      changedIds: [journey.id],
    },
  );
}

export function compareVersions(state: WorkspaceState): VersionComparison {
  const statuses: ProposalStatus[] = ["pending", "approved", "rejected", "stale", "applied"];
  const proposalCounts = Object.fromEntries(
    statuses.map((status) => [status, state.proposals.filter((proposal) => proposal.status === status).length]),
  ) as Record<ProposalStatus, number>;
  return {
    baselineVersion: 1,
    currentVersion: state.checkoutVersion,
    baselineIssueCount: 6,
    currentOpenIssueCount: state.issues.length
      ? state.issues.filter((issue) => issue.status !== "fixed").length
      : 6,
    fixedIssueIds: state.issues.filter((issue) => issue.status === "fixed").map((issue) => issue.id),
    baselineJourneyStatus: state.baselineJourney?.status === "failed" ? "failed" : "not-run",
    currentJourneyStatus: state.journey?.status ?? "not-run",
    currentJourneyFailureStep: state.journey?.failureStep ?? null,
    proposalCounts,
  };
}

export function currentOpenIssues(state: WorkspaceState): string[] {
  return state.issues.filter((issue) => issue.status !== "fixed").map((issue) => issue.id);
}

export function nextActionsForPhase(phase: WorkspacePhase): string[] {
  switch (phase) {
    case "BASELINE":
      return ["scan_current_checkout", "replay_keyboard_journey"];
    case "SCANNED":
      return ["get_issue_details", "get_fix_options", "stage_fix"];
    case "PROPOSALS_STAGED":
    case "HUMAN_REVIEW":
      return ["Review proposals in the visible interface", "stage_fix"];
    case "READY_TO_APPLY":
      return ["apply_approved_fixes"];
    case "APPLIED":
      return ["replay_keyboard_journey", "compare_versions", "undo_last_applied_fix"];
    case "VERIFIED":
      return ["compare_versions", "export_patch_manifest", "undo_last_applied_fix"];
  }
}
