import {
  Activity,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  GitCompareArrows,
  ListChecks,
  Play,
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

const phases = ["BASELINE", "SCANNED", "HUMAN_REVIEW", "READY_TO_APPLY", "APPLIED", "VERIFIED"] as const;

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

  useEffect(() => {
    if (state.phase === "BASELINE" || state.phase === "SCANNED") setPanel("issues");
    if (["PROPOSALS_STAGED", "HUMAN_REVIEW", "READY_TO_APPLY"].includes(state.phase)) setPanel("proposals");
    if (state.phase === "VERIFIED") setPanel("journey");
  }, [state.phase]);

  const currentPhaseIndex = Math.max(
    0,
    phases.findIndex((phase) => phase === state.phase) >= 0
      ? phases.findIndex((phase) => phase === state.phase)
      : state.phase === "PROPOSALS_STAGED"
        ? 2
        : 0,
  );

  const tabs: Array<{ id: PanelName; label: string; icon: typeof ListChecks; count?: number }> = [
    { id: "issues", label: "Issues", icon: ListChecks, ...(state.issues.length ? { count: openIssueCount } : {}) },
    { id: "proposals", label: "Proposals", icon: Sparkles, ...(pendingProposalCount ? { count: pendingProposalCount } : {}) },
    { id: "journey", label: "Journey", icon: GitCompareArrows },
    { id: "activity", label: "Activity", icon: Activity, count: state.activity.length },
  ];

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
            <button
              aria-label="Run journey"
              className="header-button"
              disabled={running}
              onClick={() => void api.replay("human", false)}
              type="button"
            >
              <Play aria-hidden="true" size={14} /> <span className="hidden sm:inline">Run journey</span>
            </button>
            <button aria-label="Reset demo" className="header-button subtle" onClick={() => api.reset()} type="button">
              <RefreshCcw aria-hidden="true" size={14} /> <span className="hidden lg:inline">Reset demo</span>
            </button>
          </div>
        </div>

        <div className="phase-rail" aria-label={`Workspace phase: ${state.phase.replaceAll("_", " ")}`}>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {phases.map((phase, index) => (
              <div className={`phase-node ${index <= currentPhaseIndex ? "complete" : ""} ${phase === state.phase ? "current" : ""}`} key={phase}>
                <span>{index < currentPhaseIndex ? <CheckCircle2 aria-hidden="true" size={12} /> : <CircleDot aria-hidden="true" size={10} />}</span>
                <small>{phase.replaceAll("_", " ")}</small>
              </div>
            ))}
          </div>
          <div className="view-toggle" aria-label="Checkout view">
            <button aria-pressed={viewingBaseline} onClick={() => setViewingBaseline(true)} type="button">Baseline</button>
            <button aria-pressed={!viewingBaseline} onClick={() => setViewingBaseline(false)} type="button">Current</button>
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
        <span>Synthetic data · Browser-local state · No accessibility certification claim</span>
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
