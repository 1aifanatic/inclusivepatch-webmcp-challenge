import { Check, GitCommitHorizontal, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { FixProposal } from "../domain/types";
import { useWorkspace } from "../state/workspaceStore";

function valueLabel(value: unknown): string {
  if (value === null) return "Not set";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
}

const statusStyle: Record<FixProposal["status"], string> = {
  pending: "status-badge status-pending",
  approved: "status-badge status-approved",
  rejected: "status-badge status-rejected",
  stale: "status-badge status-stale",
  applied: "status-badge status-applied",
};

export function ProposalsPanel() {
  const { state, api } = useWorkspace();
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [revisionText, setRevisionText] = useState<Record<string, string>>({});
  const currentProposals = state.proposals.filter((proposal) => proposal.checkoutVersion === state.checkoutVersion);
  const approvedIds = currentProposals.filter((proposal) => proposal.status === "approved").map((proposal) => proposal.id);
  const lowRiskPending = currentProposals.filter((proposal) => proposal.status === "pending" && proposal.risk === "low");

  const approveSafe = () => {
    for (const proposal of lowRiskPending) api.approve(proposal.id);
  };

  if (state.proposals.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><GitCommitHorizontal aria-hidden="true" size={25} /></span>
        <h3>No proposals staged</h3>
        <p>Open a scan finding and stage one bounded remediation. The checkout will not change until you approve and apply it.</p>
        <button className="button-secondary" onClick={() => void api.scan()} type="button">Return to scan</button>
      </div>
    );
  }

  return (
    <div className="panel-scroll">
      <div className="panel-toolbar panel-toolbar-sticky sticky top-0 z-10 backdrop-blur">
        <div>
          <p className="eyebrow">Approval queue</p>
          <p className="panel-summary">{currentProposals.length} current / {state.proposals.length} total</p>
        </div>
        {lowRiskPending.length > 0 && (
          <button className="button-secondary" onClick={approveSafe} type="button">
            <ShieldCheck aria-hidden="true" size={15} /> Approve low-risk
          </button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {[...state.proposals].reverse().map((proposal) => {
          const issue = state.issues.find((candidate) => candidate.id === proposal.issueId);
          const isCurrent = proposal.checkoutVersion === state.checkoutVersion;
          return (
            <article className={`proposal-card ${!isCurrent ? "opacity-70" : ""}`} key={proposal.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="proposal-id">{proposal.id}</span>
                    <span className={statusStyle[proposal.status]}>
                      {proposal.status}
                    </span>
                    {proposal.risk === "medium" && (
                      <span className="status-badge status-human-review">
                        human wording
                      </span>
                    )}
                  </div>
                  <h3 className="proposal-title">{issue?.title ?? proposal.issueId}</h3>
                </div>
                <span className="proposal-version">v{proposal.checkoutVersion}</span>
              </div>

              <div className="proposal-diff mt-4">
                <div>
                  <span>Before</span>
                  <strong>{valueLabel(proposal.beforeValue)}</strong>
                </div>
                <div aria-hidden="true" className="diff-arrow">→</div>
                <div>
                  <span>Proposed</span>
                  <strong>{valueLabel(proposal.proposedValue)}</strong>
                </div>
              </div>

              <p className="proposal-rationale">{proposal.rationale}</p>
              {proposal.supersedesProposalId && (
                <p className="revision-link">
                  <RotateCcw aria-hidden="true" size={13} /> Revised from {proposal.supersedesProposalId}
                </p>
              )}
              {proposal.rejectionReason && (
                <div className="rejection-note">
                  <strong className="block text-xs uppercase tracking-[0.08em]">Human rejection</strong>
                  <span className="mt-1 block">{proposal.rejectionReason}</span>
                </div>
              )}

              {proposal.status === "pending" && isCurrent && (
                <div className="proposal-actions">
                  <label className="field-label" htmlFor={`reject-${proposal.id}`}>Rejection reason</label>
                  <input
                    className="studio-input"
                    id={`reject-${proposal.id}`}
                    maxLength={240}
                    onChange={(event) =>
                      setRejectionReasons((current) => ({ ...current, [proposal.id]: event.target.value }))
                    }
                    placeholder={proposal.risk === "medium" ? "e.g. Too vague for the order context" : "Explain why this option should change"}
                    value={rejectionReasons[proposal.id] ?? ""}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="button-danger" onClick={() => api.reject(proposal.id, rejectionReasons[proposal.id] ?? "")} type="button">
                      <X aria-hidden="true" size={15} /> Reject
                    </button>
                    <button className="button-primary" onClick={() => api.approve(proposal.id)} type="button">
                      <Check aria-hidden="true" size={15} /> Approve
                    </button>
                  </div>
                </div>
              )}

              {proposal.status === "rejected" && proposal.optionId === "name_final_action" && isCurrent && (
                <div className="proposal-actions">
                  <label className="field-label" htmlFor={`revise-${proposal.id}`}>Revised accessible name</label>
                  <input
                    className="studio-input"
                    id={`revise-${proposal.id}`}
                    maxLength={120}
                    onChange={(event) => setRevisionText((current) => ({ ...current, [proposal.id]: event.target.value }))}
                    value={revisionText[proposal.id] ?? "Review and place order"}
                  />
                  <button
                    className="button-primary mt-3 w-full"
                    onClick={() =>
                      api.stageFix({
                        issueId: proposal.issueId,
                        optionId: proposal.optionId,
                        proposedText: revisionText[proposal.id] ?? "Review and place order",
                      })
                    }
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={15} /> Stage revision
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="proposal-apply-bar sticky bottom-0 p-4 backdrop-blur sm:p-5">
        <button
          className="button-primary w-full py-3"
          disabled={approvedIds.length === 0 || state.journey?.status === "running"}
          onClick={() => api.apply(approvedIds)}
          type="button"
        >
          <GitCommitHorizontal aria-hidden="true" size={16} />
          Apply {approvedIds.length || "no"} approved {approvedIds.length === 1 ? "fix" : "fixes"}
        </button>
        <p className="guard-note">Rejected, pending, and stale proposals are excluded by domain guards.</p>
      </div>
    </div>
  );
}
