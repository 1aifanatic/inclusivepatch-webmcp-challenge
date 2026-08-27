import { ArrowUpRight, ScanSearch, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "../state/workspaceStore";

const severityStyles: Record<string, string> = {
  critical: "severity-badge severity-badge-critical",
  serious: "severity-badge severity-badge-serious",
  moderate: "severity-badge severity-badge-moderate",
  minor: "severity-badge severity-badge-minor",
};

export function IssuesPanel() {
  const { state, api } = useWorkspace();
  const [labelText, setLabelText] = useState("Submit");
  const openIssues = state.issues.filter((issue) => issue.status !== "fixed");
  const selected = state.issues.find((issue) => issue.id === state.selectedIssueId) ?? openIssues[0] ?? state.issues[0];

  const stageAll = () => {
    for (const issue of openIssues) {
      const alreadyActive = state.proposals.some(
        (proposal) =>
          proposal.issueId === issue.id &&
          proposal.checkoutVersion === state.checkoutVersion &&
          ["pending", "approved"].includes(proposal.status),
      );
      if (!alreadyActive && issue.options[0]) {
        api.stageFix({
          issueId: issue.id,
          optionId: issue.options[0].id,
          ...(issue.id === "A11Y-006" ? { proposedText: labelText } : {}),
        });
      }
    }
  };

  if (state.issues.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><ScanSearch aria-hidden="true" size={25} /></span>
        <h3>No scan recorded</h3>
        <p>Run the deterministic fixture scan to map all six planted barriers to the live checkout.</p>
        <button className="button-primary" onClick={() => void api.scan()} type="button">
          <ScanSearch aria-hidden="true" size={16} /> Run accessibility scan
        </button>
      </div>
    );
  }

  return (
    <div className="panel-scroll">
      <div className="panel-toolbar">
        <div>
          <p className="eyebrow">Scan findings</p>
          <p className="panel-summary">{openIssues.length} open · {state.issues.length - openIssues.length} fixed</p>
        </div>
        {openIssues.length > 0 && (
          <button className="button-secondary" onClick={stageAll} type="button">
            <Sparkles aria-hidden="true" size={15} /> Stage all
          </button>
        )}
      </div>

      <div className="issue-list" aria-label="Accessibility issues">
        {state.issues.map((issue) => (
          <button
            aria-current={selected?.id === issue.id ? "true" : undefined}
            className="issue-row"
            key={issue.id}
            onClick={() => api.selectIssue(issue.id)}
            type="button"
          >
            <span className={`severity-dot severity-${issue.severity}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="issue-id">{issue.id}</span>
                <span className={severityStyles[issue.severity]}>
                  {issue.status}
                </span>
              </span>
              <span className="issue-title">{issue.title}</span>
            </span>
            <ArrowUpRight aria-hidden="true" className="row-arrow" size={15} />
          </button>
        ))}
      </div>

      {selected && (
        <article className="issue-detail" aria-labelledby={`detail-${selected.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{selected.detectionSource} evidence</p>
              <h3 className="detail-title" id={`detail-${selected.id}`}>
                {selected.title}
              </h3>
            </div>
            <span className={severityStyles[selected.severity]}>
              {selected.severity}
            </span>
          </div>
          <p className="detail-description">{selected.description}</p>
          <ul className="mt-4 space-y-2">
            {selected.evidence.map((evidence) => (
              <li className="evidence-item" key={evidence}>{evidence}</li>
            ))}
          </ul>
          {selected.options.map((option) => {
            const active = state.proposals.some(
              (proposal) =>
                proposal.issueId === selected.id &&
                proposal.checkoutVersion === state.checkoutVersion &&
                ["pending", "approved"].includes(proposal.status),
            );
            return (
              <div className="fix-option" key={option.id}>
                <div>
                  <p className="fix-option-title">{option.label}</p>
                  <p className="fix-option-description">{option.description}</p>
                </div>
                {selected.requiresHumanReview && (
                  <div className="mt-3">
                    <label className="field-label" htmlFor="proposed-action-name">Proposed assistive wording</label>
                    <input
                      className="studio-input"
                      id="proposed-action-name"
                      maxLength={120}
                      onChange={(event) => setLabelText(event.target.value)}
                      value={labelText}
                    />
                    <p className="human-review-hint">Human review required. Try “Submit” to demonstrate rejection.</p>
                  </div>
                )}
                <button
                  className="button-primary mt-4 w-full"
                  disabled={active || selected.status === "fixed"}
                  onClick={() =>
                    api.stageFix({
                      issueId: selected.id,
                      optionId: option.id,
                      ...(selected.requiresHumanReview ? { proposedText: labelText } : {}),
                    })
                  }
                  type="button"
                >
                  {active ? "Proposal already staged" : selected.status === "fixed" ? "Already fixed" : "Stage for human review"}
                </button>
              </div>
            );
          })}
        </article>
      )}
    </div>
  );
}
