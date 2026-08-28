# Submission release record

This file identifies the immutable submission release. The GitHub release records the
exact commit SHA and Cloudflare version ID after the tagged build is deployed.

| Field | Value |
| --- | --- |
| Release | `v1.2.0-submission` |
| Git commit | Tagged as `v1.2.0-submission`; full SHA recorded in the GitHub release |
| Cloudflare Worker | `inclusivepatch` |
| Cloudflare version | Tagged `inclusivepatch-v1.2.0`; exact version ID recorded in the GitHub release |
| Production URL | <https://inclusivepatch.aiconic-innovations.workers.dev> |
| Repository | <https://github.com/1aifanatic/inclusivepatch-webmcp-challenge> |
| Deployment source | Authenticated Wrangler CLI from a clean checkout of public `main` |
| Known-good rollback | Cloudflare version `7837f1a6-af19-4082-aa1b-bf1abfcb59c9` |
| Demo video | Attached to the public GitHub release as `inclusivepatch-demo.mp4` |
| Video SHA-256 | `2443646cb4a1f5ed4cae2a1edb0fa5c9f4f8267a68c45bc314872333562a62dc` |
| Freeze rule | Do not modify repository, live site, or submission during judging. |

The editable video project and cloned-voice source tracks remain local and are intentionally excluded from Git. Only the approved rendered MP4 is published.
