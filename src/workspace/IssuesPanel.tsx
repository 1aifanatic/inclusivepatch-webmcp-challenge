import { ArrowUpRight, ScanSearch, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "../state/workspaceStore";

const severityStyles: Record<string, string> = {
  critical: "bg-[#fee9e4] text-[#9b2f1f]",
  serious: "bg-[#fff0dc] text-[#925012]",
  moderate: "bg-[#edf0e4] text-[#53641e]",
  minor: "bg-[#eaf0ee] text-[#50635c]",
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
          <p className="mt-1 text-sm text-[#66736f]">{openIssues.length} open · {state.issues.length - openIssues.length} fixed</p>
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
                <span className="text-xs font-semibold tracking-[0.06em] text-[#6b7974]">{issue.id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${severityStyles[issue.severity]}`}>
                  {issue.status}
                </span>
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-[#24332e]">{issue.title}</span>
            </span>
            <ArrowUpRight aria-hidden="true" className="text-[#8b9994]" size={15} />
          </button>
        ))}
      </div>

      {selected && (
        <article className="issue-detail" aria-labelledby={`detail-${selected.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{selected.detectionSource} evidence</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#17231f]" id={`detail-${selected.id}`}>
                {selected.title}
              </h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${severityStyles[selected.severity]}`}>
              {selected.severity}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#5f6d68]">{selected.description}</p>
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
                  <p className="text-sm font-semibold text-[#22312c]">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#687671]">{option.description}</p>
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
                    <p className="mt-1.5 text-xs text-[#8a5a27]">Human review required. Try “Submit” to demonstrate rejection.</p>
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
