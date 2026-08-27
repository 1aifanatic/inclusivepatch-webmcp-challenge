# Testing InclusivePatch

## Automated evidence

| Gate | Command | Coverage |
| --- | --- | --- |
| Strict types | `pnpm run typecheck` | Application, WebMCP browser declarations, test code, config |
| Unit/integration | `pnpm run test` | Six probes, contrast, patch catalog, guards, state, replay, registration, fallback, reset |
| Browser E2E | `pnpm run test:e2e` | Golden rejection/revision path, download, reset, mocked WebMCP lifecycle and visible updates |
| Production build | `pnpm run build` | Cloudflare Vite build and generated deployment configuration |

The WebMCP evaluation contract contains 20 cases in the PRD distribution: five golden prompt paraphrases, four partial requests, four rejection/revision requests, three undo/reapply requests, and four unsafe or ambiguous requests. Automated tests prove that every declared expected call is phase-available and runtime-schema-valid. They do not replace live probabilistic evaluation in ChatGPT.

## Manual live-agent evaluation

For each eval case in `tests/webmcp/eval-cases.ts`:

1. Reset the demo and prepare the declared workspace phase.
2. Submit the prompt in ChatGPT's in-app browser.
3. Record the first selected site tool and arguments.
4. Confirm that visible state matches the pass condition.
5. Record pass/fail and any unexpected recovery calls.

Release target: at least 18 of 20 complete correctly, with at least 18 of 20 selecting the correct first tool.

## Production smoke test

- Open the workers.dev URL without authentication.
- Confirm zero console errors and no framework overlay.
- Confirm the WebMCP availability state in a supported browser.
- Run the baseline journey and scan; verify the expected failure and six findings.
- Complete the rejection/revision/application/replay/export flow.
- Refresh and confirm documented local persistence, then Reset and confirm exact baseline restoration.
- Compare the deployed version and public repository commit.
