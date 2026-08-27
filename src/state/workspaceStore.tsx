import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { runAxeAdapter } from "../accessibility/scanner";
import { buildJourneyEvents } from "../journey/journeyRunner";
import { downloadManifest, serializeManifest } from "../export/patchManifest";
import {
  DomainError,
  appendJourneyEvent,
  applyApprovedProposals,
  approveProposal,
  compareVersions,
  createInitialWorkspaceState,
  finishJourney,
  nextActionsForPhase,
  recordActivity,
  rejectProposal,
  scanWorkspace,
  selectIssue,
  stageProposal,
  startJourney,
  undoLastAppliedFix,
} from "../domain/workspaceEngine";
import type {
  AccessibilityIssue,
  Actor,
  FixOption,
  ToolResult,
  VersionComparison,
  WorkspaceState,
} from "../domain/types";

const STORAGE_KEY = "inclusivepatch.workspace.v1";

export interface WorkspaceSnapshot {
  phase: WorkspaceState["phase"];
  checkoutVersion: number;
  selectedIssueId: string | null;
  selectedComponentId: string | null;
  issues: Array<{ id: string; title: string; severity: string; status: string }>;
  proposals: Array<{
    id: string;
    issueId: string;
    optionId: string;
    status: string;
    proposedValue: unknown;
    checkoutVersion: number;
  }>;
  journey: { id: string; status: string; failureStep: string | null } | null;
}

export interface WorkspaceApi {
  reset(): ToolResult<{ reset: true }>;
  scan(actor?: Actor, toolName?: string): Promise<ToolResult<{ issueIds: string[]; openCount: number }>>;
  selectIssue(issueId: string): ToolResult<{ issueId: string }>;
  stageFix(
    input: { issueId: string; optionId: string; proposedText?: string },
    actor?: "human" | "agent",
    toolName?: string,
  ): ToolResult<{ proposalId: string }>;
  approve(proposalId: string): ToolResult<{ proposalId: string }>;
  reject(proposalId: string, reason: string): ToolResult<{ proposalId: string }>;
  apply(proposalIds: string[], actor?: Actor, toolName?: string): ToolResult<{ proposalIds: string[] }>;
  undo(actor?: Actor, toolName?: string): ToolResult<{ undone: boolean }>;
  replay(
    actor?: Actor,
    reducedMotion?: boolean,
    signal?: AbortSignal,
    toolName?: string,
  ): Promise<ToolResult<{ journeyId: string | null; status: string }>>;
  cancelJourney(): ToolResult<{ cancelled: boolean }>;
  compare(): ToolResult<VersionComparison>;
  getWorkspace(): ToolResult<WorkspaceSnapshot>;
  getIssue(issueId: string): ToolResult<AccessibilityIssue | null>;
  getOptions(issueId: string): ToolResult<FixOption[]>;
  exportManifest(
    format: "json" | "markdown",
    actor?: Actor,
    toolName?: string,
    triggerDownload?: boolean,
  ): ToolResult<{ filename: string; content: string }>;
  clearMessage(): void;
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  api: WorkspaceApi;
  message: { tone: "success" | "error" | "info"; text: string } | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadStoredState(): WorkspaceState {
  if (typeof window === "undefined") return createInitialWorkspaceState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialWorkspaceState();
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.checkoutVersion !== "number" ||
      !parsed.config ||
      !Array.isArray(parsed.issues) ||
      !Array.isArray(parsed.proposals) ||
      !Array.isArray(parsed.activity)
    ) {
      return createInitialWorkspaceState();
    }
    const restored = parsed as WorkspaceState;
    return restored.journey?.status === "running"
      ? {
          ...restored,
          journey: {
            ...restored.journey,
            status: "cancelled",
            completedAt: new Date().toISOString(),
          },
        }
      : restored;
  } catch {
    return createInitialWorkspaceState();
  }
}

function snapshot(state: WorkspaceState): WorkspaceSnapshot {
  return {
    phase: state.phase,
    checkoutVersion: state.checkoutVersion,
    selectedIssueId: state.selectedIssueId,
    selectedComponentId: state.selectedComponentId,
    issues: state.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      severity: issue.severity,
      status: issue.status,
    })),
    proposals: state.proposals.map((proposal) => ({
      id: proposal.id,
      issueId: proposal.issueId,
      optionId: proposal.optionId,
      status: proposal.status,
      proposedValue: proposal.proposedValue,
      checkoutVersion: proposal.checkoutVersion,
    })),
    journey: state.journey
      ? {
          id: state.journey.id,
          status: state.journey.status,
          failureStep: state.journey.failureStep,
        }
      : null,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(loadStoredState);
  const [message, setMessage] = useState<WorkspaceContextValue["message"]>(null);
  const stateRef = useRef(state);
  const journeyControllerRef = useRef<AbortController | null>(null);

  const commit = useCallback((operation: (current: WorkspaceState) => WorkspaceState) => {
    const next = operation(stateRef.current);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const success = useCallback(<T,>(next: WorkspaceState, text: string, data: T): ToolResult<T> => {
    setMessage({ tone: "success", text });
    const changedIds = next.activity.at(-1)?.changedIds ?? [];
    return {
      ok: true,
      code: null,
      message: text,
      workspacePhase: next.phase,
      checkoutVersion: next.checkoutVersion,
      changedIds,
      data,
      nextRecommendedActions: nextActionsForPhase(next.phase),
    };
  }, []);

  const failure = useCallback(<T,>(error: unknown, data: T): ToolResult<T> => {
    const current = stateRef.current;
    const code = error instanceof DomainError ? error.code : "INVALID_INPUT";
    const text = error instanceof Error ? error.message : "The operation could not be completed.";
    setMessage({ tone: "error", text });
    return {
      ok: false,
      code,
      message: text,
      workspacePhase: current.phase,
      checkoutVersion: current.checkoutVersion,
      changedIds: [],
      data,
      nextRecommendedActions: nextActionsForPhase(current.phase),
    };
  }, []);

  const api = useMemo<WorkspaceApi>(() => {
    const reset: WorkspaceApi["reset"] = () => {
      journeyControllerRef.current?.abort();
      window.localStorage.removeItem(STORAGE_KEY);
      const next = commit(() => createInitialWorkspaceState());
      return success(next, "Baseline restored exactly.", { reset: true });
    };

    const scan: WorkspaceApi["scan"] = async (actor = "human", toolName) => {
      try {
        const axeEvidence = await runAxeAdapter(document.querySelector("#checkout-fixture"));
        const next = commit((current) => scanWorkspace(current, actor, toolName, axeEvidence));
        const openIds = next.issues.filter((issue) => issue.status !== "fixed").map((issue) => issue.id);
        return success(next, `Scan complete: ${openIds.length} open issue${openIds.length === 1 ? "" : "s"}.`, {
          issueIds: openIds,
          openCount: openIds.length,
        });
      } catch (error) {
        return failure(error, { issueIds: [], openCount: 0 });
      }
    };

    const select: WorkspaceApi["selectIssue"] = (issueId) => {
      try {
        const next = commit((current) => selectIssue(current, issueId));
        setMessage({ tone: "info", text: `${issueId} highlighted in the checkout.` });
        return {
          ok: true,
          code: null,
          message: `${issueId} selected.`,
          workspacePhase: next.phase,
          checkoutVersion: next.checkoutVersion,
          changedIds: [issueId, next.selectedComponentId ?? "checkout"],
          data: { issueId },
          nextRecommendedActions: nextActionsForPhase(next.phase),
        };
      } catch (error) {
        return failure(error, { issueId });
      }
    };

    const stage: WorkspaceApi["stageFix"] = (input, actor = "human", toolName) => {
      try {
        const next = commit((current) => stageProposal(current, input, actor, toolName));
        const proposal = next.proposals.at(-1)!;
        return success(next, `${proposal.id} staged for review; checkout unchanged.`, { proposalId: proposal.id });
      } catch (error) {
        return failure(error, { proposalId: "" });
      }
    };

    const approve: WorkspaceApi["approve"] = (proposalId) => {
      try {
        const next = commit((current) => approveProposal(current, proposalId));
        return success(next, `${proposalId} approved.`, { proposalId });
      } catch (error) {
        return failure(error, { proposalId });
      }
    };

    const reject: WorkspaceApi["reject"] = (proposalId, reason) => {
      try {
        const next = commit((current) => rejectProposal(current, proposalId, reason));
        return success(next, `${proposalId} rejected; its value was not applied.`, { proposalId });
      } catch (error) {
        return failure(error, { proposalId });
      }
    };

    const apply: WorkspaceApi["apply"] = (proposalIds, actor = "human", toolName) => {
      try {
        const next = commit((current) => applyApprovedProposals(current, proposalIds, actor, toolName));
        return success(next, `${proposalIds.length} approved remediation${proposalIds.length === 1 ? "" : "s"} applied.`, {
          proposalIds,
        });
      } catch (error) {
        return failure(error, { proposalIds: [] });
      }
    };

    const undo: WorkspaceApi["undo"] = (actor = "human", toolName) => {
      try {
        const next = commit((current) => undoLastAppliedFix(current, actor, toolName));
        return success(next, "Latest remediation batch reversed; verification invalidated.", { undone: true });
      } catch (error) {
        return failure(error, { undone: false });
      }
    };

    const replay: WorkspaceApi["replay"] = async (
      actor = "human",
      reducedMotion = false,
      externalSignal,
      toolName,
    ) => {
      try {
        const started = commit(startJourney);
        const runId = started.journey!.id;
        const configAtStart = { ...started.config };
        const controller = new AbortController();
        journeyControllerRef.current = controller;
        const abortFromExternal = () => controller.abort();
        externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
        const events = buildJourneyEvents(configAtStart);
        for (const journeyEvent of events) {
          if (controller.signal.aborted) break;
          if (!reducedMotion) await new Promise((resolve) => window.setTimeout(resolve, 125));
          else await Promise.resolve();
          if (controller.signal.aborted) break;
          commit((current) => appendJourneyEvent(current, journeyEvent));
        }
        externalSignal?.removeEventListener("abort", abortFromExternal);
        const currentRun = stateRef.current.journey;
        if (!currentRun || currentRun.id !== runId) {
          return failure(new DomainError("INVALID_INPUT", "Journey was replaced by another workspace action."), {
            journeyId: runId,
            status: "cancelled",
          });
        }
        if (currentRun.status === "cancelled") {
          journeyControllerRef.current = null;
          return success(stateRef.current, "Keyboard journey cancelled.", { journeyId: runId, status: "cancelled" });
        }
        if (currentRun.status !== "running") {
          return failure(new DomainError("INVALID_INPUT", "Journey was replaced by another workspace action."), {
            journeyId: runId,
            status: "cancelled",
          });
        }
        const status = controller.signal.aborted
          ? "cancelled"
          : currentRun.events.every((item) => item.status === "passed")
            ? "passed"
            : "failed";
        const next = commit((current) => finishJourney(current, status, actor, toolName));
        journeyControllerRef.current = null;
        return success(next, `Keyboard journey ${status}.`, { journeyId: runId, status });
      } catch (error) {
        journeyControllerRef.current = null;
        return failure(error, { journeyId: null, status: "failed" });
      }
    };

    const cancelJourney: WorkspaceApi["cancelJourney"] = () => {
      const current = stateRef.current;
      if (current.journey?.status !== "running") {
        return failure(new DomainError("INVALID_INPUT", "No journey is currently running."), { cancelled: false });
      }
      journeyControllerRef.current?.abort();
      const next = commit((value) => finishJourney(value, "cancelled", "human"));
      journeyControllerRef.current = null;
      return success(next, "Keyboard journey cancelled.", { cancelled: true });
    };

    const compare: WorkspaceApi["compare"] = () => {
      const current = stateRef.current;
      return {
        ok: true,
        code: null,
        message: `Compared baseline version 1 with current version ${current.checkoutVersion}.`,
        workspacePhase: current.phase,
        checkoutVersion: current.checkoutVersion,
        changedIds: [],
        data: compareVersions(current),
        nextRecommendedActions: nextActionsForPhase(current.phase),
      };
    };

    const getWorkspace: WorkspaceApi["getWorkspace"] = () => {
      const current = stateRef.current;
      return {
        ok: true,
        code: null,
        message: `Workspace is ${current.phase} at checkout version ${current.checkoutVersion}.`,
        workspacePhase: current.phase,
        checkoutVersion: current.checkoutVersion,
        changedIds: [],
        data: snapshot(current),
        nextRecommendedActions: nextActionsForPhase(current.phase),
      };
    };

    const getIssue: WorkspaceApi["getIssue"] = (issueId) => {
      const current = stateRef.current;
      const issue = current.issues.find((candidate) => candidate.id === issueId) ?? null;
      if (!issue) return failure(new DomainError("ISSUE_NOT_FOUND", `Issue ${issueId} was not found.`), null);
      return {
        ok: true,
        code: null,
        message: `${issueId}: ${issue.title}`,
        workspacePhase: current.phase,
        checkoutVersion: current.checkoutVersion,
        changedIds: [],
        data: issue,
        nextRecommendedActions: nextActionsForPhase(current.phase),
      };
    };

    const getOptions: WorkspaceApi["getOptions"] = (issueId) => {
      const current = stateRef.current;
      const issue = current.issues.find((candidate) => candidate.id === issueId);
      if (!issue) return failure(new DomainError("ISSUE_NOT_FOUND", `Issue ${issueId} was not found.`), []);
      return {
        ok: true,
        code: null,
        message: `${issue.options.length} permitted option${issue.options.length === 1 ? "" : "s"} for ${issueId}.`,
        workspacePhase: current.phase,
        checkoutVersion: current.checkoutVersion,
        changedIds: [],
        data: issue.options,
        nextRecommendedActions: nextActionsForPhase(current.phase),
      };
    };

    const exportPatch: WorkspaceApi["exportManifest"] = (
      format,
      actor = "human",
      toolName,
      triggerDownload = true,
    ) => {
      try {
        const beforeExport = stateRef.current;
        const filename = `inclusivepatch-patch-v${beforeExport.checkoutVersion}.${format === "json" ? "json" : "md"}`;
        const content = serializeManifest(beforeExport, format);
        if (triggerDownload) downloadManifest(beforeExport, format);
        const current = commit((workspace) =>
          recordActivity(workspace, {
            actor,
            action: "Export patch manifest",
            ...(toolName ? { toolName } : {}),
            inputSummary: `${format} at version ${workspace.checkoutVersion}`,
            changedIds: [filename],
          }),
        );
        setMessage({ tone: "success", text: `${filename} generated locally.` });
        return {
          ok: true,
          code: null,
          message: `${filename} generated locally by ${actor}${toolName ? ` via ${toolName}` : ""}.`,
          workspacePhase: current.phase,
          checkoutVersion: current.checkoutVersion,
          changedIds: [filename],
          data: { filename, content },
          nextRecommendedActions: nextActionsForPhase(current.phase),
        };
      } catch (error) {
        return failure(
          error instanceof DomainError ? error : new DomainError("EXPORT_FAILED", "Patch manifest export failed."),
          { filename: "", content: "" },
        );
      }
    };

    return {
      reset,
      scan,
      selectIssue: select,
      stageFix: stage,
      approve,
      reject,
      apply,
      undo,
      replay,
      cancelJourney,
      compare,
      getWorkspace,
      getIssue,
      getOptions,
      exportManifest: exportPatch,
      clearMessage: () => setMessage(null),
    };
  }, [commit, failure, success]);

  const value = useMemo(() => ({ state, api, message }), [state, api, message]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return context;
}
