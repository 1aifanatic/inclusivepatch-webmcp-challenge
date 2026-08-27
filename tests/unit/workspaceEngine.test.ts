import { describe, expect, it } from "vitest";
import {
  DomainError,
  applyApprovedProposals,
  approveProposal,
  createInitialWorkspaceState,
  rejectProposal,
  scanWorkspace,
  stageProposal,
  undoLastAppliedFix,
} from "../../src/domain/workspaceEngine";

function scanned() {
  return scanWorkspace(createInitialWorkspaceState(), "human", undefined);
}

describe("proposal and approval invariants", () => {
  it("staging never changes the checkout configuration", () => {
    const state = scanned();
    const staged = stageProposal(state, { issueId: "A11Y-001", optionId: "add_email_label" }, "agent");
    expect(staged.config).toEqual(state.config);
    expect(staged.proposals[0]?.status).toBe("pending");
  });

  it("refuses unapproved and rejected proposals", () => {
    let state = scanned();
    state = stageProposal(state, { issueId: "A11Y-006", optionId: "name_final_action", proposedText: "Submit" }, "agent");
    expect(() => applyApprovedProposals(state, ["PROP-001"], "agent")).toThrowError(DomainError);
    state = rejectProposal(state, "PROP-001", "Too vague for the order context");
    expect(() => applyApprovedProposals(state, ["PROP-001"], "agent")).toThrow(/status rejected/);
    expect(state.activity.some((record) => record.action === "Reject proposal")).toBe(true);
  });

  it("connects rejection, revision, approval, application, stale guards, and undo", () => {
    let state = scanned();
    state = stageProposal(state, { issueId: "A11Y-006", optionId: "name_final_action", proposedText: "Submit" }, "agent");
    state = rejectProposal(state, "PROP-001", "Too vague for checkout");
    state = stageProposal(
      state,
      { issueId: "A11Y-006", optionId: "name_final_action", proposedText: "Review and place order" },
      "agent",
    );
    expect(state.proposals[1]?.supersedesProposalId).toBe("PROP-001");
    state = approveProposal(state, "PROP-002");
    const applied = applyApprovedProposals(state, ["PROP-002"], "agent");
    expect(applied.config.continueAccessibleName).toBe("Review and place order");
    expect(applied.checkoutVersion).toBe(2);
    expect(() => applyApprovedProposals(applied, ["PROP-002"], "agent")).toThrow(/version 1/);
    const undone = undoLastAppliedFix(applied, "human");
    expect(undone.config.continueAccessibleName).toBeNull();
    expect(undone.checkoutVersion).toBe(3);
    expect(undone.journey).toBeNull();
  });

  it("applies all six approved patches as one versioned batch", () => {
    const options = [
      ["A11Y-001", "add_email_label"],
      ["A11Y-002", "restore_focus_order"],
      ["A11Y-003", "remove_delivery_trap"],
      ["A11Y-004", "announce_validation_errors"],
      ["A11Y-005", "upgrade_helper_contrast"],
      ["A11Y-006", "name_final_action"],
    ] as const;
    let state = scanned();
    for (const [issueId, optionId] of options) {
      state = stageProposal(
        state,
        { issueId, optionId, ...(issueId === "A11Y-006" ? { proposedText: "Review and place order" } : {}) },
        "agent",
      );
      state = approveProposal(state, state.proposals.at(-1)!.id);
    }
    const ids = state.proposals.map((proposal) => proposal.id);
    state = applyApprovedProposals(state, ids, "agent");
    expect(state.checkoutVersion).toBe(2);
    expect(state.issues.every((issue) => issue.status === "fixed")).toBe(true);
    expect(state.proposals.every((proposal) => proposal.status === "applied")).toBe(true);
  });
});
