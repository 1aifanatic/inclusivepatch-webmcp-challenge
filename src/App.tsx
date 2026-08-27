import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  GitCompareArrows,
  ListChecks,
  Radio,
  RefreshCcw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "./state/workspaceStore";
import { useWebMcpTools } from "./webmcp/useWebMcpTools";
import { ActivityPanel } from "./workspace/ActivityPanel";
import { Checkout } from "./workspace/Checkout";
import { IssuesPanel } from "./workspace/IssuesPanel";
import { JourneyPanel } from "./workspace/JourneyPanel";
import { ProposalsPanel } from "./workspace/ProposalsPanel";

type PanelName = "issues" | "proposals" | "journey" | "activity";

function Studio() {
  const { state, api, message } = useWorkspace();
  const [panel, setPanel] = useState<PanelName>("issues");
  const [viewingBaseline, setViewingBaseline] = useState(false);
  const webmcp = useWebMcpTools(state.phase, api);
  const running = state.journey?.status === "running";
  const openIssueCount = state.issues.filter((issue) => issue.status !== "fixed").length;
  const pendingProposalCount = state.proposals.filter(
    (proposal) => proposal.checkoutVersion === state.checkoutVersion && ["pending", "approved"].includes(proposal.status),
  ).length;
  const baselineProved = state.baselineJourney?.status === "failed";
  const scanRecorded = state.issues.length > 0;
  const fixesApplied = state.appliedHistory.length > 0 && openIssueCount === 0;
  const journeyVerified = state.phase === "VERIFIED";
  const guideMilestones = [
    { label: "Baseline proof", detail: "Expected to fail", complete: baselineProved },
    { label: "Scan checkout", detail: "Map 6 barriers", complete: scanRecorded },
    { label: "Human review", detail: "Approve before apply", complete: fixesApplied },
    { label: "Journey proof", detail: "Repeat 11 checks", complete: journeyVerified },
  ];
  const activeGuideIndex = state.checkoutVersion === 1 && !baselineProved ? 0 : !scanRecorded ? 1 : !fixesApplied ? 2 : 3;

  useEffect(() => {
    if (state.phase === "BASELINE" || state.phase === "SCANNED") setPanel("issues");
    if (["PROPOSALS_STAGED", "HUMAN_REVIEW", "READY_TO_APPLY"].includes(state.phase)) setPanel("proposals");
    if (state.phase === "VERIFIED") setPanel("journey");
  }, [state.phase]);

  const tabs: Array<{ id: PanelName; label: string; icon: typeof ListChecks; count?: number }> = [
    { id: "issues", label: "Issues", icon: ListChecks, ...(state.issues.length ? { count: openIssueCount } : {}) },
    { id: "proposals", label: "Proposals", icon: Sparkles, ...(pendingProposalCount ? { count: pendingProposalCount } : {}) },
    { id: "journey", label: "Journey", icon: GitCompareArrows },
    { id: "activity", label: "Activity", icon: Activity, count: state.activity.length },
  ];

  const openPanel = (nextPanel: PanelName) => {
    setPanel(nextPanel);
    window.requestAnimationFrame(() => {
      const inspector = document.querySelector(".inspector-column");
      if (inspector instanceof HTMLElement && typeof inspector.scrollIntoView === "function") {
        inspector.scrollIntoView({ block: "start" });
      }
    });
  };

  const guideAction = (() => {
    if (!baselineProved && state.checkoutVersion === 1) {
      return {
        label: running ? "Baseline running" : "Run baseline proof",
        disabled: running,
        run: () => {
          openPanel("journey");
          void api.replay("human", false);
        },
      };
    }
    if (!scanRecorded) {
      return {
        label: "Scan checkout",
        disabled: false,
        run: () => {
          openPanel("issues");
          void api.scan();
        },
      };
    }
    if (!fixesApplied) {
      const needsIssueReview = state.phase === "SCANNED" || state.phase === "APPLIED";
      return {
        label: state.phase === "APPLIED" ? "Review remaining issues" : state.phase === "SCANNED" ? "Review findings" : "Review proposals",
        disabled: false,
        run: () => openPanel(needsIssueReview ? "issues" : "proposals"),
      };
    }
    return {
      label: journeyVerified ? "View passing proof" : "Open verification",
      disabled: false,
      run: () => openPanel("journey"),
    };
  })();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-topline">
          <div className="flex min-w-0 items-center gap-3">
            <div className="logo-mark" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="brand-title">InclusivePatch</h1>
                <span className="brand-badge hidden sm:inline-flex">
                  WebMCP studio
                </span>
              </div>
              <p className="brand-tagline hidden md:block">Repair with an agent. Approve every change. Prove the journey.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`webmcp-pill webmcp-${webmcp.status}`}
              title={webmcp.error ?? `${webmcp.toolNames.length} phase-aware tools registered`}
            >
              <Radio aria-hidden="true" size={13} />
              <span className="webmcp-label"><span className="hidden sm:inline">WebMCP </span>{webmcp.status.replace("registration-", "")}</span>
              {webmcp.status === "available" && <b>{webmcp.toolNames.length}</b>}
            </div>
            <span className="header-metric"><b>v{state.checkoutVersion}</b><small>checkout</small></span>
            <button aria-label="Reset demo" className="header-button subtle" onClick={() => api.reset()} type="button">
              <RefreshCcw aria-hidden="true" size={14} /> <span className="hidden lg:inline">Reset demo</span>
            </button>
          </div>
        </div>

        <div className="judge-guide" aria-label={`Judge walkthrough. Workspace phase: ${state.phase.replaceAll("_", " ")}`}>
          <div className="judge-guide-intro">
            <strong>Judge walkthrough</strong>
            <span>One guarded path from failure to proof.</span>
          </div>
          <ol className="guide-path">
            {guideMilestones.map((milestone, index) => (
              <li
                aria-current={index === activeGuideIndex ? "step" : undefined}
                className={`${milestone.complete ? "complete" : ""} ${index === activeGuideIndex ? "current" : ""}`}
                key={milestone.label}
              >
                <span className="guide-status">
                  {milestone.complete ? <CheckCircle2 aria-hidden="true" size={14} /> : <CircleDot aria-hidden="true" size={12} />}
                </span>
                <span className="guide-copy">
                  <strong>{milestone.label}</strong>
                  <small>{milestone.detail}</small>
                </span>
              </li>
            ))}
          </ol>
          <div className="guide-controls">
            <button className="guide-action" disabled={guideAction.disabled} onClick={guideAction.run} type="button">
              {guideAction.label} <ArrowRight aria-hidden="true" size={14} />
            </button>
            <div className="view-toggle" aria-label="Checkout view">
              <button aria-pressed={viewingBaseline} onClick={() => setViewingBaseline(true)} type="button">Baseline</button>
              <button aria-pressed={!viewingBaseline} onClick={() => setViewingBaseline(false)} type="button">Current</button>
            </div>
          </div>
        </div>
      </header>

      <main className="workspace-grid" id="main-content">
        <section className="workspace-column" aria-labelledby="live-checkout-heading">
          <div className="workspace-section-heading">
            <div>
              <p className="eyebrow">Shared live page</p>
              <h2 id="live-checkout-heading">Checkout fixture</h2>
            </div>
            <span className="isolation-badge"><FlaskConical aria-hidden="true" size={13} /> Isolated barrier lab</span>
          </div>
          <div className="checkout-stage">
            <Checkout
              config={state.config}
              selectedComponentId={state.selectedComponentId}
              viewingBaseline={viewingBaseline}
            />
          </div>
        </section>

        <section className="workspace-column inspector-column" aria-labelledby="inspector-heading">
          <div className="workspace-section-heading">
            <div>
              <p className="eyebrow">Review & verification</p>
              <h2 id="inspector-heading">Inspector</h2>
            </div>
            <span className="isolation-badge"><Shield aria-hidden="true" size={13} /> Human guarded</span>
          </div>
          <div className="inspector-shell">
            <nav aria-label="Inspector panels" className="panel-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    aria-current={panel === tab.id ? "page" : undefined}
                    className={panel === tab.id ? "active" : ""}
                    key={tab.id}
                    onClick={() => setPanel(tab.id)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={15} />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && <b>{tab.count}</b>}
                  </button>
                );
              })}
            </nav>
            <div className="inspector-content" id={`panel-${panel}`}>
              {panel === "issues" && <IssuesPanel />}
              {panel === "proposals" && <ProposalsPanel />}
              {panel === "journey" && <JourneyPanel />}
              {panel === "activity" && <ActivityPanel />}
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>Synthetic data / Browser-local state / No accessibility certification claim</span>
        <span>Cloudflare Workers Static Assets</span>
      </footer>

      {message && (
        <div className={`toast toast-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={api.clearMessage} type="button"><X aria-hidden="true" size={15} /></button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <Studio />
    </WorkspaceProvider>
  );
}
