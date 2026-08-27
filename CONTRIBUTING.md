# Contributing

AccessTwin is intentionally scope-limited for the challenge submission. Contributions should improve reliability, accessibility of the studio shell, test coverage, documentation, or judge comprehension without expanding into arbitrary-site scanning, authentication, persistence services, source rewriting, or certification claims.

## Development

```bash
pnpm install
pnpm run dev
```

Before opening a pull request, run:

```bash
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run build
```

Keep domain logic pure and typed. Stable IDs belong in fixture and catalog modules. Human controls and WebMCP executors must call the same workspace services. New tool inputs must reject unknown properties and must never accept selectors, HTML, scripts, or executable code.

## Submission freeze

Do not merge or deploy changes after the competition deadline while judging is active. Use a fork for post-deadline experiments.
