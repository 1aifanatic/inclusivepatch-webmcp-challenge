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
});
