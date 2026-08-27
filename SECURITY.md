# Security policy

## Supported version

The `main` branch and the tagged challenge submission release are supported until the end of judging. After the submission freeze, security reports should not trigger a production change without competition-administrator approval.

## Reporting

Please open a private GitHub security advisory rather than a public issue for a suspected vulnerability. Include the affected URL or commit, reproduction steps, impact, and any suggested mitigation.

## Security boundaries

- WebMCP inputs are strict Zod schemas with stable issue, option, proposal, journey, and version IDs.
- Unknown properties, arbitrary selectors, HTML, JavaScript, and executable expressions are rejected.
- There is no `eval`, dynamic `Function`, authentication, database, payment processing, external runtime API, analytics, or user-data transmission.
- Human approval and checkout-version checks are enforced in domain logic, not only in the UI.
- Rejected, pending, stale, duplicate, unknown, or already-applied proposals cannot be applied.
- Tools are registered only on the top-level same-origin document. No `exposedTo` cross-origin access is configured.
- Browser exports are local downloads. Reset removes the saved competition state and restores the fixture contract.
- Cloudflare serves restrictive response headers from `public/_headers`.

AccessTwin is a synthetic demonstration and does not provide accessibility certification or legal compliance advice.
