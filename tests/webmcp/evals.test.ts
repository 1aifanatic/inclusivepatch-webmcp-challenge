import { describe, expect, it } from "vitest";
import type { WorkspaceApi } from "../../src/state/workspaceStore";
import {
  applyInputSchema,
  compareInputSchema,
  emptyInputSchema,
  exportInputSchema,
  issueInputSchema,
  scanInputSchema,
  stageFixInputSchema,
} from "../../src/webmcp/schemas";
import { toolDefinitionsForPhase } from "../../src/webmcp/toolDefinitions";
import { WEBMCP_EVAL_CASES } from "./eval-cases";

const api = {} as WorkspaceApi;
const schemas = {
  get_workspace_state: emptyInputSchema,
  scan_current_checkout: scanInputSchema,
  get_issue_details: issueInputSchema,
  get_fix_options: issueInputSchema,
  stage_fix: stageFixInputSchema,
  apply_approved_fixes: applyInputSchema,
  replay_keyboard_journey: emptyInputSchema,
  compare_versions: compareInputSchema,
  undo_last_applied_fix: emptyInputSchema,
  export_patch_manifest: exportInputSchema,
};

describe("20-case WebMCP evaluation contract", () => {
  it("contains the PRD category distribution", () => {
    expect(WEBMCP_EVAL_CASES).toHaveLength(20);
    expect(WEBMCP_EVAL_CASES.filter((item) => item.category === "golden")).toHaveLength(5);
    expect(WEBMCP_EVAL_CASES.filter((item) => item.category === "partial")).toHaveLength(4);
    expect(WEBMCP_EVAL_CASES.filter((item) => item.category === "rejection")).toHaveLength(4);
    expect(WEBMCP_EVAL_CASES.filter((item) => item.category === "undo")).toHaveLength(3);
    expect(WEBMCP_EVAL_CASES.filter((item) => item.category === "unsafe")).toHaveLength(4);
  });

  for (const evalCase of WEBMCP_EVAL_CASES) {
    it(`${evalCase.id} has an available, schema-valid expected call`, () => {
      const names = toolDefinitionsForPhase(evalCase.phase, api).map((tool) => tool.name);
      expect(names).toContain(evalCase.expectedCall.functionName);
      for (const acceptableName of evalCase.acceptableFirstTools ?? [evalCase.expectedCall.functionName]) {
        expect(names).toContain(acceptableName);
      }
      const schema = schemas[evalCase.expectedCall.functionName as keyof typeof schemas];
      expect(schema.safeParse(evalCase.expectedCall.arguments).success).toBe(true);
      expect(evalCase.passCondition.length).toBeGreaterThan(10);
    });
  }
});
