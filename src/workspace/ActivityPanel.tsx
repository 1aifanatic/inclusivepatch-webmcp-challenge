import { History } from "lucide-react";
import { useWorkspace } from "../state/workspaceStore";

export function ActivityPanel() {
  const { state } = useWorkspace();
  return (
    <div className="panel-scroll">
      <div className="panel-toolbar">
        <div>
          <p className="eyebrow">Immutable local history</p>
          <p className="panel-summary">{state.activity.length} recorded actions</p>
        </div>
        <History aria-hidden="true" className="panel-toolbar-icon" size={19} />
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <table className="activity-table">
          <caption className="sr-only">Workspace mutation and tool activity history</caption>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Version</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {[...state.activity].reverse().map((record) => (
              <tr key={record.id}>
                <td>
                  <strong>{record.action}</strong>
                  <span>{record.inputSummary}</span>
                  <small>{record.toolName ?? record.id} / {new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
                </td>
                <td><span className={`actor-pill actor-${record.actor}`}>{record.actor}</span></td>
                <td>v{record.checkoutVersion}<small>{record.workspacePhase.replaceAll("_", " ")}</small></td>
                <td><span className={`result-${record.result}`}>{record.result}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
