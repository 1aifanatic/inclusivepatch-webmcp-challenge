import type { WorkspaceApi } from "../state/workspaceStore";
import type { ToolResult, WorkspacePhase } from "../domain/types";
import type { ZodType } from "zod";
import {
  JSON_SCHEMAS,
  applyInputSchema,
  compareInputSchema,
  emptyInputSchema,
  exportInputSchema,
  issueInputSchema,
  replayInputSchema,
  scanInputSchema,
  stageFixInputSchema,
} from "./schemas";

export interface SiteToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
  execute(input: unknown, context: { signal: AbortSignal }): Promise<string> | string;
}

function agentOutput<T>(result: ToolResult<T>): string {
  const serialized = JSON.stringify(result);
  return serialized.length <= 1500
    ? serialized
    : JSON.stringify({
        ok: result.ok,
        code: result.code,
        message: result.message,
        workspacePhase: result.workspacePhase,
        checkoutVersion: result.checkoutVersion,
        changedIds: result.changedIds,
        nextRecommendedActions: result.nextRecommendedActions,
      });
}

function safeExecute<T>(
  api: WorkspaceApi,
  schema: ZodType<T>,
  input: unknown,
  run: (parsed: T) => string | Promise<string>,
): string | Promise<string> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return run(parsed.data);
  const current = api.getWorkspace();
  return agentOutput({
    ...current,
    ok: false,
    code: "INVALID_INPUT",
    message: parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ").slice(0, 500),
    changedIds: [],
    data: null,
  });
}

function allDefinitions(api: WorkspaceApi): Record<string, SiteToolDefinition> {
  return {
    get_workspace_state: {
      name: "get_workspace_state",
      title: "Get AccessTwin workspace state",
      description: "Read the current phase, version, findings, proposals, selection, and journey result before planning the next action.",
      inputSchema: JSON_SCHEMAS.empty,
      annotations: { readOnlyHint: true },
      execute: (input) => safeExecute(api, emptyInputSchema, input, () => agentOutput(api.getWorkspace())),
    },
    scan_current_checkout: {
      name: "scan_current_checkout",
      title: "Scan the current checkout",
      description: "Run deterministic checks on the open synthetic checkout and record version-bound findings in the visible Issues panel.",
      inputSchema: JSON_SCHEMAS.scan,
      annotations: { readOnlyHint: false },
      execute: (input) =>
        safeExecute(api, scanInputSchema, input, async () =>
          agentOutput(await api.scan("agent", "scan_current_checkout")),
        ),
    },
    get_issue_details: {
      name: "get_issue_details",
      title: "Inspect one accessibility issue",
      description: "Read evidence, severity, affected component, and review requirement for one current stable issue ID.",
      inputSchema: JSON_SCHEMAS.issue,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        safeExecute(api, issueInputSchema, input, (parsed) => agentOutput(api.getIssue(parsed.issueId))),
    },
    get_fix_options: {
      name: "get_fix_options",
      title: "Get permitted fix options",
      description: "Read the bounded remediation options that belong to one current issue before staging a proposal.",
      inputSchema: JSON_SCHEMAS.issue,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        safeExecute(api, issueInputSchema, input, (parsed) => agentOutput(api.getOptions(parsed.issueId))),
    },
    stage_fix: {
      name: "stage_fix",
      title: "Stage one remediation",
      description: "Create a visible proposal for one permitted option. This does not modify the checkout; a human must approve it first.",
      inputSchema: JSON_SCHEMAS.stage,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) =>
        safeExecute(api, stageFixInputSchema, input, (parsed) =>
          agentOutput(
            api.stageFix(
              {
                issueId: parsed.issueId,
                optionId: parsed.optionId,
                ...(parsed.proposedText ? { proposedText: parsed.proposedText } : {}),
              },
              "agent",
              "stage_fix",
            ),
          ),
        ),
    },
    apply_approved_fixes: {
      name: "apply_approved_fixes",
      title: "Apply human-approved fixes",
      description: "Apply only selected, current-version proposals already approved in the visible interface; then increment the checkout version.",
      inputSchema: JSON_SCHEMAS.apply,
      annotations: { readOnlyHint: false },
      execute: (input) =>
        safeExecute(api, applyInputSchema, input, (parsed) =>
          agentOutput(api.apply(parsed.proposalIds, "agent", "apply_approved_fixes")),
        ),
    },
    replay_keyboard_journey: {
      name: "replay_keyboard_journey",
      title: "Replay the keyboard checkout",
      description: "Run the deterministic in-page keyboard journey, show every assertion, and record a version-bound pass or failure.",
      inputSchema: JSON_SCHEMAS.replay,
      annotations: { readOnlyHint: false },
      execute: (input, { signal }) =>
        safeExecute(api, replayInputSchema, input, async () =>
          agentOutput(await api.replay("agent", false, signal, "replay_keyboard_journey")),
        ),
    },
    compare_versions: {
      name: "compare_versions",
      title: "Compare baseline and current versions",
      description: "Read explicit issue, proposal, and keyboard-journey differences between baseline version 1 and the current version.",
      inputSchema: JSON_SCHEMAS.compare,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        safeExecute(api, compareInputSchema, input, (parsed) => {
          const current = api.getWorkspace();
          if (parsed.currentVersion !== current.checkoutVersion) {
            return agentOutput({
              ...api.compare(),
              ok: false,
              code: "VERSION_NOT_FOUND",
              message: `Current checkout version is ${current.checkoutVersion}, not ${parsed.currentVersion}.`,
              changedIds: [],
            });
          }
          return agentOutput(api.compare());
        }),
    },
    undo_last_applied_fix: {
      name: "undo_last_applied_fix",
      title: "Undo the latest applied fix batch",
      description: "Reverse the latest applied remediation batch, increment the checkout version, and invalidate prior verification.",
      inputSchema: JSON_SCHEMAS.empty,
      annotations: { readOnlyHint: false },
      execute: (input) =>
        safeExecute(api, emptyInputSchema, input, () =>
          agentOutput(api.undo("agent", "undo_last_applied_fix")),
        ),
    },
    export_patch_manifest: {
      name: "export_patch_manifest",
      title: "Export the remediation manifest",
      description: "Generate a local JSON or Markdown download containing applied, rejected, and verified version evidence.",
      inputSchema: JSON_SCHEMAS.export,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) =>
        safeExecute(api, exportInputSchema, input, (parsed) => {
          const result = api.exportManifest(parsed.format, "agent", "export_patch_manifest", true);
          return agentOutput({ ...result, data: { filename: result.data.filename } });
        }),
    },
  };
}

const PHASE_TOOLS: Record<WorkspacePhase, string[]> = {
  BASELINE: ["get_workspace_state", "scan_current_checkout", "replay_keyboard_journey"],
  SCANNED: [
    "get_workspace_state",
    "scan_current_checkout",
    "get_issue_details",
    "get_fix_options",
    "stage_fix",
    "replay_keyboard_journey",
  ],
  PROPOSALS_STAGED: [
    "get_workspace_state",
    "get_issue_details",
    "get_fix_options",
    "stage_fix",
    "replay_keyboard_journey",
  ],
  HUMAN_REVIEW: [
    "get_workspace_state",
    "get_issue_details",
    "get_fix_options",
    "stage_fix",
    "replay_keyboard_journey",
  ],
  READY_TO_APPLY: [
    "get_workspace_state",
    "get_issue_details",
    "get_fix_options",
    "stage_fix",
    "apply_approved_fixes",
    "replay_keyboard_journey",
  ],
  APPLIED: [
    "get_workspace_state",
    "scan_current_checkout",
    "replay_keyboard_journey",
    "compare_versions",
    "undo_last_applied_fix",
    "export_patch_manifest",
  ],
  VERIFIED: [
    "get_workspace_state",
    "scan_current_checkout",
    "replay_keyboard_journey",
    "compare_versions",
    "undo_last_applied_fix",
    "export_patch_manifest",
  ],
};

export function toolDefinitionsForPhase(phase: WorkspacePhase, api: WorkspaceApi): SiteToolDefinition[] {
  const definitions = allDefinitions(api);
  return PHASE_TOOLS[phase].map((name) => definitions[name]).filter((tool): tool is SiteToolDefinition => Boolean(tool));
}
