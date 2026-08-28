# Submission release record

This file identifies the immutable submission release. The GitHub release records the
exact commit SHA and Cloudflare version ID after the tagged build is deployed.

| Field | Value |
| --- | --- |
| Release | `v1.2.1-submission` |
| Git commit | Tagged as `v1.2.1-submission`; full SHA recorded in the GitHub release |
| Cloudflare Worker | `inclusivepatch` |
| Cloudflare version | Tagged `inclusivepatch-v1.2.1`; exact version ID recorded in the GitHub release |
| Production URL | <https://inclusivepatch.aiconic-innovations.workers.dev> |
| Repository | <https://github.com/1aifanatic/inclusivepatch-webmcp-challenge> |
| Deployment source | Authenticated Wrangler CLI from a clean checkout of public `main` |
| Known-good rollback | Cloudflare version `97776c9a-f218-4a42-b009-f2d2699ea01b` |
| Demo video | Attached to the public GitHub release as `inclusivepatch-demo.mp4` |
| Video SHA-256 | `f554aea4597ad588a33be0342b3bad8b94a4daa9e98fc33adf99dc2fbfbd7862` |
| Freeze rule | Do not modify repository, live site, or submission during judging. |

The editable video project and cloned-voice source tracks remain local and are intentionally excluded from Git. Only the approved rendered MP4 is published.
