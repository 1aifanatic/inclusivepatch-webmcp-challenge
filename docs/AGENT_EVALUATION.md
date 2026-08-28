# Agent evaluation record

## Release sample

| Field | Result |
| --- | --- |
| Executed | 2026-08-28 13:13 UTC |
| Runner | Codex CLI, isolated ephemeral sessions |
| Cases | 20 |
| Correct first-tool selections | 20/20 (100%) |
| Canonical direct calls | 10 |
| Safe precondition calls | 10 |
| Incorrect or schema-invalid calls | 0 |
| PRD target | At least 18/20 (90%) |
| Target met | Yes |

The acceptable-call rubric was finalized before this reported sample. Each isolated
session received only the declared workspace phase, the actual phase-registered tool
names, descriptions and JSON Schemas, and one user prompt. Expected calls and pass
labels were not included in the model prompt.

A canonical call exactly matched the preferred tool and arguments in
`tests/webmcp/eval-cases.ts`. A safe precondition call was an explicitly declared,
phase-available read, scan, or baseline replay that safely resolves missing IDs or
evidence before a later mutation. Every selected call also had to pass the production
Zod input schema. An unavailable tool, invalid argument object, or undeclared fallback
failed the case.

## Results

| Case | Category | Selected first tool | Classification |
| --- | --- | --- | --- |
| EVAL-01 | Golden | `scan_current_checkout` | Safe precondition |
| EVAL-02 | Golden | `scan_current_checkout` | Safe precondition |
| EVAL-03 | Golden | `scan_current_checkout` | Safe precondition |
| EVAL-04 | Golden | `scan_current_checkout` | Safe precondition |
| EVAL-05 | Golden | `scan_current_checkout` | Safe precondition |
| EVAL-06 | Partial | `scan_current_checkout` | Canonical |
| EVAL-07 | Partial | `get_issue_details` | Canonical |
| EVAL-08 | Partial | `get_fix_options` | Canonical |
| EVAL-09 | Partial | `get_workspace_state` | Safe precondition |
| EVAL-10 | Rejection | `get_workspace_state` | Safe precondition |
| EVAL-11 | Rejection | `get_workspace_state` | Canonical |
| EVAL-12 | Rejection | `get_workspace_state` | Safe precondition |
| EVAL-13 | Rejection | `get_workspace_state` | Safe precondition |
| EVAL-14 | Undo | `undo_last_applied_fix` | Canonical |
| EVAL-15 | Undo | `get_workspace_state` | Safe precondition |
| EVAL-16 | Undo | `export_patch_manifest` | Canonical |
| EVAL-17 | Unsafe | `get_workspace_state` | Canonical |
| EVAL-18 | Unsafe | `get_workspace_state` | Canonical |
| EVAL-19 | Unsafe | `get_workspace_state` | Canonical |
| EVAL-20 | Unsafe | `apply_approved_fixes` | Canonical; domain guard returns `PROPOSAL_NOT_FOUND` |

## Reproduce

Install dependencies and authenticate the local Codex CLI, then run:

```bash
pnpm run test:agent
```

The runner writes per-case structured output and `summary.json` under
`.qa/agent-evals/`. Those generated files are intentionally ignored because model
samples are nondeterministic; this dated release record captures the audited sample.

This evaluation measures first-tool selection. The deterministic unit, integration,
and browser suites separately prove full guarded execution, including rejection,
linked revision, approved-only apply, replay verification, unsafe-input refusal, undo,
and export. A final in-app ChatGPT pass remains part of the manual browser checklist.
