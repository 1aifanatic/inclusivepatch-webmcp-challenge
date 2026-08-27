import { Check, CircleStop, Download, Play, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "../state/workspaceStore";

export function JourneyPanel() {
  const { state, api } = useWorkspace();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const comparison = api.compare().data;
  const running = state.journey?.status === "running";

  return (
    <div className="panel-scroll">
      <div className="panel-toolbar">
        <div>
          <p className="eyebrow">Deterministic replay</p>
          <p className="mt-1 text-sm text-[#66736f]">11 explicit assertions · version bound</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-[#5f6d68]">
          <input checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} type="checkbox" />
          Reduced motion
        </label>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="comparison-stat">
            <span>Baseline · v1</span>
            <strong>{comparison.baselineIssueCount} issues</strong>
            <small className={comparison.baselineJourneyStatus === "failed" ? "text-[#a23d2d]" : ""}>
              Journey {comparison.baselineJourneyStatus}
            </small>
          </div>
          <div className="comparison-stat current">
            <span>Current · v{comparison.currentVersion}</span>
            <strong>{comparison.currentOpenIssueCount} open</strong>
            <small className={comparison.currentJourneyStatus === "passed" ? "text-[#28714f]" : ""}>
              Journey {comparison.currentJourneyStatus}
            </small>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {running ? (
            <button className="button-danger col-span-2" onClick={() => api.cancelJourney()} type="button">
              <CircleStop aria-hidden="true" size={16} /> Cancel replay
            </button>
          ) : (
            <button className="button-primary col-span-2 py-3" onClick={() => void api.replay("human", reducedMotion)} type="button">
              <Play aria-hidden="true" size={16} /> Run keyboard journey
            </button>
          )}
        </div>

        <div className="journey-timeline mt-5" aria-live="polite" aria-label="Keyboard journey assertions">
          {state.journey?.events.length ? (
            state.journey.events.map((event, index) => (
              <div className="journey-step" key={event.stepId}>
                <span className={`journey-status ${event.status}`}>
                  {event.status === "passed" ? <Check aria-hidden="true" size={13} /> : <X aria-hidden="true" size={13} />}
                </span>
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <strong>{String(index + 1).padStart(2, "0")} · {event.label}</strong>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${event.status === "passed" ? "text-[#28714f]" : "text-[#a23d2d]"}`}>
                      {event.status}
                    </span>
                  </div>
                  <p>Expected: {event.expected}</p>
                  <p>Observed: {event.actual}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cfd8d3] p-6 text-center text-sm text-[#68756f]">
              No replay evidence yet. Run the baseline before applying fixes to preserve before-and-after proof.
            </div>
          )}
          {running && <div className="mt-3 text-center text-xs font-semibold text-[#d16f2d]">Replay in progress…</div>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#e2e7e4] pt-5">
          <button className="button-secondary" disabled={state.appliedHistory.length === 0 || running} onClick={() => api.undo()} type="button">
            <RotateCcw aria-hidden="true" size={15} /> Undo latest
          </button>
          <button className="button-secondary" disabled={state.checkoutVersion === 1} onClick={() => api.exportManifest("json")} type="button">
            <Download aria-hidden="true" size={15} /> Export JSON
          </button>
          <button className="button-ghost col-span-2" disabled={state.checkoutVersion === 1} onClick={() => api.exportManifest("markdown")} type="button">
            Export readable Markdown manifest
          </button>
        </div>
      </div>
    </div>
  );
}
