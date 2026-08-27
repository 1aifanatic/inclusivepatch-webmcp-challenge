import { describe, expect, it } from "vitest";
import type { WorkspaceApi } from "../../src/state/workspaceStore";
import { toolDefinitionsForPhase } from "../../src/webmcp/toolDefinitions";

const api = {} as WorkspaceApi;

describe("phase-aware WebMCP registration", () => {
  it("exposes only the three baseline tools", () => {
    expect(toolDefinitionsForPhase("BASELINE", api).map((tool) => tool.name)).toEqual([
      "get_workspace_state",
      "scan_current_checkout",
      "replay_keyboard_journey",
    ]);
  });

  it("adds approval application only when ready", () => {
    expect(toolDefinitionsForPhase("SCANNED", api).map((tool) => tool.name)).not.toContain("apply_approved_fixes");
    expect(toolDefinitionsForPhase("READY_TO_APPLY", api).map((tool) => tool.name)).toContain("apply_approved_fixes");
  });

  it("exposes compare, undo, and export after application", () => {
    const names = toolDefinitionsForPhase("APPLIED", api).map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["compare_versions", "undo_last_applied_fix", "export_patch_manifest"]));
    expect(names).not.toContain("stage_fix");
  });

  it("marks only non-mutating tools as read-only", () => {
    const tools = toolDefinitionsForPhase("VERIFIED", api);
    const readOnly = tools.filter((tool) => tool.annotations.readOnlyHint).map((tool) => tool.name);
    expect(readOnly).toEqual(expect.arrayContaining(["get_workspace_state", "compare_versions"]));
    expect(readOnly).not.toEqual(expect.arrayContaining(["replay_keyboard_journey", "export_patch_manifest"]));
  });

  it("returns the standard INVALID_INPUT envelope for malformed arguments", async () => {
    const currentApi = {
      getWorkspace: () => ({
        ok: true,
        code: null,
        message: "Workspace is SCANNED.",
        workspacePhase: "SCANNED",
        checkoutVersion: 1,
        changedIds: [],
        data: null,
        nextRecommendedActions: ["stage_fix"],
      }),
    } as unknown as WorkspaceApi;
    const stage = toolDefinitionsForPhase("SCANNED", currentApi).find((tool) => tool.name === "stage_fix")!;
    const result = JSON.parse(
      await stage.execute(
        { issueId: "not-an-issue", optionId: "<script>" },
        { signal: new AbortController().signal },
      ),
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: "INVALID_INPUT", workspacePhase: "SCANNED", changedIds: [] }),
    );
  });
});
