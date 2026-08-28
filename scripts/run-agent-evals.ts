import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceApi } from "../src/state/workspaceStore";
import {
  applyInputSchema,
  compareInputSchema,
  emptyInputSchema,
  exportInputSchema,
  issueInputSchema,
  replayInputSchema,
  scanInputSchema,
  stageFixInputSchema,
} from "../src/webmcp/schemas";
import { toolDefinitionsForPhase } from "../src/webmcp/toolDefinitions";
import { WEBMCP_EVAL_CASES } from "../tests/webmcp/eval-cases";

const root = process.cwd();
const outputDirectory = path.join(root, ".qa", "agent-evals");
const schemaPath = path.join(root, "tests", "webmcp", "agent-call.schema.json");
const api = {} as WorkspaceApi;
const schemas = {
  get_workspace_state: emptyInputSchema,
  scan_current_checkout: scanInputSchema,
  get_issue_details: issueInputSchema,
  get_fix_options: issueInputSchema,
  stage_fix: stageFixInputSchema,
  apply_approved_fixes: applyInputSchema,
  replay_keyboard_journey: replayInputSchema,
  compare_versions: compareInputSchema,
  undo_last_applied_fix: emptyInputSchema,
  export_patch_manifest: exportInputSchema,
};

await mkdir(outputDirectory, { recursive: true });

function runCodex(arguments_: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("codex", arguments_, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Codex exited ${code}: ${output.slice(-2000)}`));
    });
  });
}

async function evaluate(evalCase: (typeof WEBMCP_EVAL_CASES)[number]) {
  const availableTools = toolDefinitionsForPhase(evalCase.phase, api).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  const outputPath = path.join(outputDirectory, `${evalCase.id}.json`);
  const prompt = [
    "Select exactly one FIRST WebMCP site-tool call for the user request.",
    "Use only a listed tool and arguments allowed by its JSON Schema.",
    "The listed tools are already the current phase-aware registrations, and the supplied phase is authoritative.",
    "Do not call get_workspace_state merely to reconfirm that phase. Do not include explanation.",
    "Put the call arguments in argumentsJson as a compact JSON object string.",
    `Current workspace phase: ${evalCase.phase}`,
    `Available tools: ${JSON.stringify(availableTools)}`,
    `User request: ${JSON.stringify(evalCase.prompt)}`,
  ].join("\n\n");

  await runCodex([
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "--cd",
    root,
    prompt,
  ]);

  const raw = JSON.parse(await readFile(outputPath, "utf8"));
  const actual = {
    functionName: raw.functionName,
    arguments: JSON.parse(raw.argumentsJson),
  };
  const exactMatch = JSON.stringify(actual) === JSON.stringify(evalCase.expectedCall);
  const acceptableFirstTools = evalCase.acceptableFirstTools ?? [evalCase.expectedCall.functionName];
  const schema = schemas[actual.functionName as keyof typeof schemas];
  const schemaValid = Boolean(schema?.safeParse(actual.arguments).success);
  const passed = acceptableFirstTools.includes(actual.functionName) && schemaValid;

  return {
    id: evalCase.id,
    category: evalCase.category,
    phase: evalCase.phase,
    prompt: evalCase.prompt,
    expected: evalCase.expectedCall,
    acceptableFirstTools,
    actual,
    exactMatch,
    schemaValid,
    selectionClass: exactMatch ? "canonical" : passed ? "safe-precondition" : "incorrect",
    passed,
  };
}

const results = [];
for (const evalCase of WEBMCP_EVAL_CASES) {
  results.push(await evaluate(evalCase));
  console.log(`completed ${results.length}/${WEBMCP_EVAL_CASES.length}`);
}

const passed = results.filter((result) => result.passed).length;
const exactMatches = results.filter((result) => result.exactMatch).length;
const summary = {
  generatedAt: new Date().toISOString(),
  runner: "Codex CLI isolated first-tool selection",
  total: results.length,
  passed,
  exactMatches,
  failed: results.length - passed,
  passRate: passed / results.length,
  target: 0.9,
  targetMet: passed / results.length >= 0.9,
  results,
};

await writeFile(
  path.join(outputDirectory, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ passed, total: results.length, targetMet: summary.targetMet }));
