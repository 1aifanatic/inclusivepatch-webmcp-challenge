import { describe, expect, it } from "vitest";
import {
  applyApprovedProposals,
  approveProposal,
  createInitialWorkspaceState,
  rejectProposal,
  scanWorkspace,
  stageProposal,
} from "../../src/domain/workspaceEngine";
import { buildPatchManifest, serializeManifest } from "../../src/export/patchManifest";

describe("patch manifest", () => {
  it("exports applied, rejected, comparison, and disclaimer evidence", () => {
    let state = scanWorkspace(createInitialWorkspaceState(), "human", undefined);
    state = stageProposal(
      state,
      { issueId: "A11Y-006", optionId: "name_final_action", proposedText: "Submit" },
      "agent",
    );
    state = rejectProposal(state, "PROP-001", "Too vague for the order context");
    state = stageProposal(
      state,
      { issueId: "A11Y-006", optionId: "name_final_action", proposedText: "Review and place order" },
      "agent",
    );
    state = approveProposal(state, "PROP-002");
    state = applyApprovedProposals(state, ["PROP-002"], "agent");

    const manifest = buildPatchManifest(state);
    expect(manifest.product).toBe("InclusivePatch");
    expect(manifest.disclaimer).toMatch(/not an accessibility certification/i);
    expect(manifest.appliedPatches).toEqual([
      expect.objectContaining({ proposalId: "PROP-002", appliedValue: "Review and place order" }),
    ]);
    expect(manifest.rejectedProposals).toEqual([
      expect.objectContaining({ proposalId: "PROP-001", reason: "Too vague for the order context" }),
    ]);
    expect(manifest.comparison.currentVersion).toBe(2);

    const serialized = JSON.parse(serializeManifest(state, "json"));
    expect(serialized).toEqual(expect.objectContaining({
      product: manifest.product,
      checkoutVersion: manifest.checkoutVersion,
      appliedPatches: manifest.appliedPatches,
      rejectedProposals: manifest.rejectedProposals,
    }));
    expect(Date.parse(serialized.exportedAt)).not.toBeNaN();
    expect(serializeManifest(state, "markdown")).toContain("## Rejected proposals");
  });
});
