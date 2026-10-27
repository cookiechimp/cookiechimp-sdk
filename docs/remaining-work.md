# Remaining SDK work and release status

Updated 27 October 2026. Scope: `cookiechimp/cookiechimp-sdk`. Platform work
belongs to Daniel; this completion sequence changes no platform code or settings.

## Live release

All nine packages, including `@cookiechimp/react-native`, are published as npm
`latest` **1.2.0** on 27 October 2026. The protected GitHub OIDC publication
completed from `150b0292be3502b355bf0a0f00118d7c557db340` in
[the release run](https://github.com/cookiechimp/cookiechimp-sdk/actions/runs/40504134674).
The [GitHub release](https://github.com/cookiechimp/cookiechimp-sdk/releases/tag/v1.2.0)
contains the exact tarballs and verification evidence.

- [Publication manifest](../release/npm-1.2.0-manifest.json)
- [Nine-package registry and provenance audit](../release/npm-1.2.0-audit.json)
- [Fresh npm consumers and signature audits](release-evidence/2026-10-27-registry-consumer.json)
- [Device and live delivery confirmation](release-evidence/2026-10-27-native-confirmation.json)
- [Native trusted publisher and completed staging cleanup](../release/npm-react-native-trusted-publisher-2026-10-27.json)

Registry bytes and source-bound provenance match all nine prepared tarballs.
Fresh npm installations passed 116 web exports, strict declarations, ESM/CJS,
Next.js production build and browser consent/vendor persistence checks. The native
consumer passed Expo types and both iOS/Android Hermes exports. Both npm signature
audits reported no invalid or missing signatures. Physical-device and live record
delivery checks were confirmed by Daniel; Codex did not independently inspect
device builds or receipt/dashboard captures. The temporary bootstrap stage was
rejected after publication and its version was never published.

The previous eight-package 1.1.0 release and its live backend captures remain
historical evidence. The 33 base/TCF locales completed
[editorial review](translation-review.md). Hosted Mintlify guides still require
the separate 1.2.0 documentation import and deployment.

## Completed SDK implementation

The three follow-ups below are implemented. Daniel authorized merging the stack
on 25 October after checking comments and current-head CI. They are published in
**1.2.0** and are not contained in the immutable 1.1.0 release.

| SDK PR | Completed change | Validation and size contract |
|---|---|---|
| [#64](https://github.com/cookiechimp/cookiechimp-sdk/pull/64) | Image pixel blocking in `./dynamic`, including detached `Image()`, image `src`/`srcset` and picture sources; restore allowed URLs and cancel stale requests | Component and real browser request-count coverage. Dynamic is 2751 B; opt-in limit 3200 B, up from 2688 B. Default core unchanged. |
| [#65](https://github.com/cookiechimp/cookiechimp-sdk/pull/65) | Share config code and remove redundant sync adapter work; enforce marginal size in CI | Core 3670 B, full core+sync 6230 B, marginal 2560 B. Meets the original unchanged 2.5 KB target. Standalone sync 3966 B of its unchanged 4355 B limit. |
| [#66](https://github.com/cookiechimp/cookiechimp-sdk/pull/66) | Own formats for MN/MD/IN/KY/RI, including required modern section headers, sensitive-data/GPC subsections and state routing | Pinned-spec vectors, strict modern decoding, CMP API, consent, GPC and reload coverage. GPP graph 3187 B; GPP-only budget 3680 B, up from 2810 B; combined IAB cap remains 12288 B. See [conformance](gpp-conformance.md). |

Image blocking (#64) and sync (#65) merged into main on 25 October. The final
GPP change merged in #66. The review found no actionable
PR comments. Each merge requires current-head checks and source parity; no review
or branch-protection bypass is part of this sequence.

## React Native SDK (published in 1.2.0)

Daniel chose on 25 October 2026 to build the React Native SDK as
`packages/react-native` in this repository on top of `@cookiechimp/core`,
replacing the unpublished scaffold in IdentitySquare/CookieChimp-ReactNative-SDK.

Merged in SDK #67 on 27 October at `0776dc61b6e67c07fb95f5d37962cf874e32a1fb`.
All seven required checks passed on that source. The implementation is published in 1.2.0:

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

Completed release gates:

1. Daniel confirmed device and live delivery checks on 27 October. See the
   [user attestation](release-evidence/2026-10-27-native-confirmation.json).
2. The native trusted publisher completed its first protected OIDC publication.
   All nine registry packages are 1.2.0, with verified bytes and provenance.
3. The GitHub release now triggers the protected main-branch OIDC workflow;
   routine releases require GitHub environment review and no npm security key.

## Remaining documentation and platform follow-ups

1. Import the exact clean SDK documentation export into CookieChimp-Docs through
   a reviewed docs PR, then verify Mintlify deployment and live routes/indexes.
   The SDK's canonical sources describe 1.2.0; hosted docs are a separate deploy.
2. Align dashboard React Native setup snippets with the published package name
   and API. This is platform work requiring Daniel's review and action.

The SDK implementation and npm publication in this checklist are complete.
Future defects and scope additions remain normal maintenance. No platform writes
or hosted documentation deployment were performed in this release sequence.

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
