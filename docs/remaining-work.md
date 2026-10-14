# Remaining work (resumed 13 Oct 2026)

Daniel resumed the SDK work on 13 Oct 2026. SPEC items 1 to 27 are merged, along with the follow-ups below. SDK PRs require Daniel's review before merge. Platform work remains limited to PR preparation and Daniel's review/action.

## Done

- M1 Core, M2 React, M3 Next.js, M4 Scripts and tooling: complete.
- M5 Connected mode (items 20 to 24): #26 sync, #27 consent log, #28 self-hosted endpoint, #29 CLI `link` and `pull`, #30 provider `endpoint` prop, #31 Next.js server config, #32 follow-ups and flake fixes.
- M6 Compliance extensions (items 25 to 27): #33 GPP, #34 TCF core and stub, #35 TCF vendor UI, #36 GPP provider wiring, #37 TCF vendor details, #38 TCF translations.

## In progress

- SDK runtime/setup fixes: PR #41, pending review. Fixes React script reconciliation, duplicate execution, ordered activation, the CLI's typed config and builds from paths containing spaces.
- Item 28 follow-up: the plain React/Vite example and static local docs search are built, pending review in a separate SDK PR. The generated index covers real section anchors; no search service or telemetry is required.
- Item 28 (docs site, llms.txt, AI skills, examples): PR #39 now includes deployment preparation and release status. Stacked on #41 until it merges. CI publishes a static docs artifact; Daniel chose to decide hosting and domain later.

## Release preparation (SPEC section 9)

- Item 29: PR #42 contains the benchmark suite and raw results in `bench/`, recorded on 13 Oct 2026. All 40 measured attempts and four excluded warmups passed. Results identify the clean measured source commit. SDK PR review and external benchmark submission remain separate steps.
- Item 30: PR #43 prepares eight coordinated 1.0 candidates, tarball validation, a fresh npm consumer and a publication workflow. No packages are published. Needs Daniel's review, actual launch prerequisites and explicit approval before publication.

## Blocked on Daniel

- Platform PRs in IdentitySquare/CookieChimp, waiting for review (never merged by bots):
  - #2773: consent sync idempotency (unique index on account and client_id). Merge first.
  - #2772: serves the offline config and sync endpoints to website accounts, adds schema_version, 304 on If-None-Match, max-age=300 with stale-while-revalidate=86400, ETag exposed through CORS, and a JSON schema. Until it ships, website accounts get 403 and the SDK falls back to the cached or in-code config.
- IAB Europe CMP registration. TCF is disabled in production until a real `cmpId` exists. The GPP CMP ID is also 0 until then.

## Known gaps and follow-ups

- TCF:
  - Current TCF v2.4 GVL disclosures are built, pending review: descriptions, illustrations and the standard feature explanation, with keyboard/mobile and safe-text checks. No CMP registration or validator approval is claimed.
  - SDK provider wiring is built in the optional `@cookiechimp/react/tcf-provider` entry, with a Next.js `TcfStub` helper, pending review. It requires an explicit application-owned feature decision, registered `cmpId` and valid vendor-list source. The regular consent UI remains available when TCF is disabled or fails.
  - No vendor list (GVL) CDN or proxy URL yet, so apps pass the list themselves.
  - Limiting TCF to Pro and connected mode needs platform support.
  - IAB validator checks are manual only.
  - The conservative TCF/GPP component sum is 10366 B of the 12288 B cap. The provider has separate bootstrap and full import-graph checks; all enforced budgets pass.
- GPP: PR #44 adds ten state sections, covering all 16 US formats in the current published IAB reference. Newer MN/MD/IN/KY/RI formats still use the national fallback.
- Translations: 29 base locales and 32 TCF label locales are machine drafts (`reviewed: false`). They need native-speaker review before 1.0.
- Sync:
  - The sync extra is 2395 B, above the original 2 KB target. SPEC was raised to 2.5 KB; trim if easy.
  - Records do not reach Tinybird.
  - No `cc_pk_` key validation, since the platform treats account hashids as public.
- Next.js: dashboard copy containing HTML falls back to the code message.
- Endpoint: the page-hide flush with custom headers sends JSON and can be dropped by the browser. Records stay queued and are resent on the next visit.
- Provider size headroom is about 12%, under the 15% target. See `docs/size.md`.
- One unexplained local e2e failure (not seen in CI). Capture a trace if it recurs.
- Commit 7b90f7c briefly included a Codex log containing a ChatGPT account ID (not a token). It was removed but remains in history.

## How to resume

- Ask Daniel to review SDK PRs before merge. All 7 CI checks (lint, typecheck, unit, component, e2e, size, ci-required) must pass on the current head SHA.
- Never copy CookieYes code. The SDK does no client-side geolocation.
- The "Drive cookiechimp-sdk build" routine is paused; resume it to restart the daily safety check.
