# SDK merge review (14 Oct 2026)

Daniel authorized Codex to review, fix and merge the SDK PRs for this completion
sequence. The review-agent skill was used to inspect each PR's changes and
surrounding implementation before merging. No platform write was performed.

## Review results

- #41: stopping a gate controller released its external script's load wait even
  though the script remained connected and loading. Another controller could
  then execute dependent code too early. A regression test failed before the
  fix and passed afterward. The shared queue now waits for the actual load/error
  event. Local lint and all 223 component tests at that PR passed; seven final-head
  CI checks passed before merge.
- #39: documented Next.js example commands did not build SDK workspace
  dependencies on a fresh clone. The commands now select the example and its
  dependencies. Both corrected production build commands passed locally, and
  seven final-head CI checks passed before merge.
- #42, #44, #45, #46, #47 and #43: no remaining actionable findings. Each diff
  was reviewed with its related implementation and tests. All seven required
  checks were green on the recorded head; additional benchmark and packed-consumer
  checks were green where present. No unresolved GitHub review threads existed.

## Merge evidence

Merge commits preserve the stack's ancestry. Each merge required the exact
reviewed head SHA to avoid merging a concurrent unreviewed change.

| PR | Reviewed head | Main merge commit |
|---|---|---|
| [#41](https://github.com/cookiechimp/cookiechimp-sdk/pull/41) | `8333a68` | `9a63286` |
| [#39](https://github.com/cookiechimp/cookiechimp-sdk/pull/39) | `78eead9` | `6c265ec` |
| [#42](https://github.com/cookiechimp/cookiechimp-sdk/pull/42) | `fd6e2aa` | `9db7061` |
| [#44](https://github.com/cookiechimp/cookiechimp-sdk/pull/44) | `4fb077b` | `53c561c` |
| [#45](https://github.com/cookiechimp/cookiechimp-sdk/pull/45) | `f50f834` | `3352977` |
| [#46](https://github.com/cookiechimp/cookiechimp-sdk/pull/46) | `4b8b732` | `68cfe02` |
| [#47](https://github.com/cookiechimp/cookiechimp-sdk/pull/47) | `7886b79` | `8fd9d35` |
| [#43](https://github.com/cookiechimp/cookiechimp-sdk/pull/43) | `86d898e` | `768dbe9` |

## Combined-source validation

After all eight merges, main at `768dbe9` was checked in a clean temporary
worktree. Fresh tarballs were built from that source and installed with npm
outside the workspace. All eight packages and 114 public entries passed:
standalone declarations, ESM/CJS loading, Next.js production build, browser
consent/persistence, React reconciliation, CSS, TCF provider lifecycle and GVL
disclosures. Chromium was 155.0.8059.40. The hashes and consumer proof are in
`release/artifacts/manifest.json` and `release/artifacts/consumer-validation.json`.

These are local candidate artifacts, not registry publication or deployment.
Native translations, platform deployment and connected delivery, IAB validation,
public history review, npm setup, hosting and external submissions remain the
launch gates recorded in [remaining work](remaining-work.md).
