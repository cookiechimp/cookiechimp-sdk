# Remaining SDK work and release status

Updated 27 October 2026. Scope: `cookiechimp/cookiechimp-sdk`. Platform work
belongs to Daniel; this completion sequence changes no platform code or settings.

## Live release

All eight packages are published as npm `latest` **1.1.0**. The protected GitHub
OIDC release completed with verified tarball integrity, provenance and npm
signatures. The [GitHub release](https://github.com/cookiechimp/cookiechimp-sdk/releases/tag/v1.1.0)
contains the packages and evidence. Docs #83 merged and Mintlify deployed the
1.1.0 guides; all 14 pages, Markdown views and both AI indexes passed live checks.

- [Registry audit](../release/npm-1.1.0-audit.json)
- [Fresh installed consumer evidence](release-evidence/2026-10-25-registry-consumer.json)
- [Completed live backend test](release-evidence/2026-10-24-live-backend.json)
- [Historical launch and merge record](launch-history-2026-10-25.md)

The live backend test verified config retrieval, accept/reject/custom records,
reload persistence and offline retry. Dashboard inspection confirmed exactly four
matching stored records and one copy of the retried decision. The installed npm
consumer verified 116 exports, a production build, CLI and browser behavior.
The 33 base/TCF locales completed [editorial review](translation-review.md).

## Completed SDK implementation

The three follow-ups below are implemented. Daniel authorized merging the stack
on 25 October after checking comments and current-head CI. They are **not yet
published** and are not contained in the immutable 1.1.0 release.

| SDK PR | Completed change | Validation and size contract |
|---|---|---|
| [#64](https://github.com/cookiechimp/cookiechimp-sdk/pull/64) | Image pixel blocking in `./dynamic`, including detached `Image()`, image `src`/`srcset` and picture sources; restore allowed URLs and cancel stale requests | Component and real browser request-count coverage. Dynamic is 2751 B; opt-in limit 3200 B, up from 2688 B. Default core unchanged. |
| [#65](https://github.com/cookiechimp/cookiechimp-sdk/pull/65) | Share config code and remove redundant sync adapter work; enforce marginal size in CI | Core 3670 B, full core+sync 6230 B, marginal 2560 B. Meets the original unchanged 2.5 KB target. Standalone sync 3966 B of its unchanged 4355 B limit. |
| [#66](https://github.com/cookiechimp/cookiechimp-sdk/pull/66) | Own formats for MN/MD/IN/KY/RI, including required modern section headers, sensitive-data/GPC subsections and state routing | Pinned-spec vectors, strict modern decoding, CMP API, consent, GPC and reload coverage. GPP graph 3187 B; GPP-only budget 3680 B, up from 2810 B; combined IAB cap remains 12288 B. See [conformance](gpp-conformance.md). |

Image blocking (#64) and sync (#65) merged into main on 25 October. The final
GPP change merged in #66. The review found no actionable
PR comments. Each merge requires current-head checks and source parity; no review
or branch-protection bypass is part of this sequence.

## React Native SDK (merged, release candidate)

Daniel chose on 25 October 2026 to build the React Native SDK as
`packages/react-native` in this repository on top of `@cookiechimp/core`,
replacing the unpublished scaffold in IdentitySquare/CookieChimp-ReactNative-SDK.

Merged in SDK #67 on 27 October at `0776dc61b6e67c07fb95f5d37962cf874e32a1fb`.
All seven required checks passed on that source. It is not yet published:

- Core runs without a browser: a synchronous `storage` adapter for
  `createConsent`, `platform: "ios" | "android"` consent records,
  `ConsentLog.retry()`, and Hermes fallbacks for Web Crypto and `TextDecoder`.
- `@cookiechimp/react-native`:
  connected and offline modes, AsyncStorage persistence, dashboard-styled
  native banner and preferences, consent records, re-consent, vendor
  callbacks, the `CookieChimp` API and hooks, a Mintlify guide and an Expo
  example outside the workspace.
- Region: Daniel chose opt-in CookieChimp geolocation on 25 October 2026. Apps
  pass `country`, or enable `geolocation`; an unknown region uses the GDPR
  fallback. See CONTRIBUTING.md.

Remaining before a React Native release:

1. Device and live delivery checks were confirmed by Daniel on 27 October.
   See the [user attestation](release-evidence/2026-10-27-native-confirmation.json);
   Codex has not independently inspected device builds or receipt/dashboard captures.
3. Complete npm package setup and its trusted-publisher binding. Daniel requested
   publication on 27 October. The 1.2.0 candidate adds the native package to the
   release cohort and fixed version group, removes `private`, consumes changesets
   and validates a separate packed Expo consumer. The publication guard keeps
   npm setup check pending. The device and delivery checks are backed by
   Daniel's direct confirmation.
4. Align the dashboard React Native setup snippets (platform repository,
   Daniel's review) with the published package name and API.

## Next release steps

1. Validate the coordinated 1.2.0 candidate: nine packages, current source,
   required CI, web consumer and native Expo consumer. Never overwrite or
   republish 1.1.0. See [the release runbook](release.md).
2. Complete the required live backend config and record-delivery verification
   for that release. Local mocks and passing fixture tests remain separate proof.
3. Publish the stable version tag as a GitHub release to start the protected
   OIDC workflow, complete GitHub environment review, and independently verify
   npm bytes, provenance and fresh consumers. Initial npm setup for the new
   native package remains a one-time prerequisite.
4. Import the exact clean SDK documentation export into CookieChimp-Docs through
   a reviewed docs PR, then verify Mintlify deployment and live routes/indexes.

The SDK implementation backlog in this checklist is complete. Future defects and
scope additions remain normal maintenance. The next release and documentation
publication remain separate approved actions.

## Optional external distribution

- Publish the prepared Agent Skills/Context7 material if Daniel selects registries
  and explicitly authorizes submission. The four skills and manifest already exist.
- Submit benchmarks only after Daniel reviews and authorizes the specific results.
  Existing measurements retain their source/dependency versions. Rerun on a clean
  current commit before claiming results for a later release. No external benchmark
  submission has been made.

## Deferred managed IAB and platform work

- Managed CMP registration, assigned ID and validation remain deliberately deferred
  in the [internal TODO](iab-integration-todo.md). This is not an ordinary SDK
  publication gate. GPP defaults to CMP ID 0. Production TCF requires valid explicit
  configuration and remains disabled by default.
- Hosted-platform SDK adoption, managed GVL hosting/access enforcement and Tinybird
  consent delivery remain separately owned platform follow-ups. Daniel determines
  their current status and authorizes any platform action. None is performed here.
- Billing counts all users, including bots. The obsolete bot analytics, retention
  and billing PR stack is not an SDK dependency and must not be revived.

## Intentional integration boundaries

- Dynamic interception must precede vendor code and image URL assignment. It cannot
  undo earlier requests or intercept other realms, captured native functions, CSS
  image URLs, parser/preload requests or unsupported HTML string sinks. Withdrawal
  blocks future assignments; it cannot retract a completed request. See the README.
- `./network` handles fetch, XHR and beacon. Image requests use `./dynamic`.
  WebSocket and EventSource are outside the network blocker's contract.
- Page-hide delivery may be dropped by the browser, particularly with custom
  headers. Persisted records retry on a later visit; the receiver must deduplicate.
- Account hashids are public identifiers, so there is no `cc_pk_` platform key
  validation requirement. Secret keys remain rejected by the sync client.
- Standard connected UI uses code-label fallbacks for dashboard HTML. The opt-in
  platform UI renders the bounded safe rich-text subset.
- GPP encoding coverage is not a certification or a determination of legal
  applicability. Applications supply publisher assertions and optional TCF inputs.

## Working rules

Follow AGENTS.md and CONTRIBUTING.md: clean-room implementation, no client-side
geolocation, no em dash characters, current-head checks, explicit npm/external
submission approval, and accurate separation of tested, merged, deployed and
published states. Keep the platform repository untouched. No recurring automation
was created by this work; the historical daily Drive routine remains paused.
