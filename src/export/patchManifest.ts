import type { WorkspaceState } from "../domain/types";
import { compareVersions } from "../domain/workspaceEngine";

export interface PatchManifest {
  product: "InclusivePatch";
  exportedAt: string;
  checkoutVersion: number;
  phase: WorkspaceState["phase"];
  disclaimer: string;
  comparison: ReturnType<typeof compareVersions>;
  appliedPatches: Array<{
    proposalId: string;
    issueId: string;
    optionId: string;
    beforeValue: unknown;
    appliedValue: unknown;
    checkoutVersion: number;
  }>;
  rejectedProposals: Array<{
    proposalId: string;
    issueId: string;
    proposedValue: unknown;
    reason: string;
  }>;
  journey: WorkspaceState["journey"];
}

export function buildPatchManifest(state: WorkspaceState): PatchManifest {
  return {
    product: "InclusivePatch",
    exportedAt: new Date().toISOString(),
    checkoutVersion: state.checkoutVersion,
    phase: state.phase,
    disclaimer: "Synthetic demonstration only. This manifest is not an accessibility certification.",
    comparison: compareVersions(state),
    appliedPatches: state.proposals
      .filter((proposal) => proposal.status === "applied")
      .map((proposal) => ({
        proposalId: proposal.id,
        issueId: proposal.issueId,
        optionId: proposal.optionId,
        beforeValue: proposal.beforeValue,
        appliedValue: proposal.proposedValue,
        checkoutVersion: proposal.checkoutVersion,
      })),
    rejectedProposals: state.proposals
      .filter((proposal) => proposal.status === "rejected")
      .map((proposal) => ({
        proposalId: proposal.id,
        issueId: proposal.issueId,
        proposedValue: proposal.proposedValue,
        reason: proposal.rejectionReason ?? "No reason recorded",
      })),
    journey: state.journey,
  };
}

export function manifestAsMarkdown(manifest: PatchManifest): string {
  const applied = manifest.appliedPatches.length
    ? manifest.appliedPatches
        .map(
          (patch) =>
            `| ${patch.proposalId} | ${patch.issueId} | ${patch.optionId} | ${JSON.stringify(patch.beforeValue)} | ${JSON.stringify(patch.appliedValue)} |`,
        )
        .join("\n")
    : "| - | - | - | - | - |";
  const rejected = manifest.rejectedProposals.length
    ? manifest.rejectedProposals
        .map((proposal) => `- ${proposal.proposalId} (${proposal.issueId}): ${proposal.reason}`)
        .join("\n")
    : "- None";
  return `# InclusivePatch patch manifest

- Exported: ${manifest.exportedAt}
- Checkout version: ${manifest.checkoutVersion}
- Workspace phase: ${manifest.phase}
- Open issues: ${manifest.comparison.currentOpenIssueCount}
- Journey: ${manifest.comparison.currentJourneyStatus}

> ${manifest.disclaimer}

## Applied patches

| Proposal | Issue | Patch | Before | Applied |
| --- | --- | --- | --- | --- |
${applied}

## Rejected proposals

${rejected}

## Verification

${manifest.journey ? `Journey ${manifest.journey.id}: **${manifest.journey.status}** at checkout version ${manifest.journey.checkoutVersion}.` : "No journey has been recorded."}
`;
}

export function serializeManifest(state: WorkspaceState, format: "json" | "markdown"): string {
  const manifest = buildPatchManifest(state);
  return format === "json" ? JSON.stringify(manifest, null, 2) : manifestAsMarkdown(manifest);
}

export function downloadManifest(state: WorkspaceState, format: "json" | "markdown"): string {
  const content = serializeManifest(state, format);
  const extension = format === "json" ? "json" : "md";
  const mime = format === "json" ? "application/json" : "text/markdown";
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `inclusivepatch-patch-v${state.checkoutVersion}.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
  return anchor.download;
}
