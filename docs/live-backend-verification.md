# Live backend verification for SDK 1.1.0

Status: live browser checks ran on 24 October 2026 using account `K8ktWD`,
which Daniel selected from cookiechimp.com's installation script. The test page
used `http://localhost:3104/connected?project=K8ktWD`; this account already permits
`localhost`. Accept, reject, custom, persistence and blocked-request retry checks
passed, with four HTTP 200 matching receipts. See the
[sanitized evidence](release-evidence/2026-10-24-live-backend.json).

Authenticated dashboard inspection completed on 25 October at 07:52 UTC.
The Consent Log filtered by the test UUID contains exactly four records whose
server IDs match the four receipts. Each detail page has the expected saved
preferences; the retry record appears once. `manualChecks.platformDeployed` is
true for this reviewed evidence. Exact-version publication approval is still
required, and no package version was published during verification.
The tested source is `6b15623974ee3e75bcc4c448b234cd767e82315e`; package and example
sources match reviewed main `dc962edff35541b77948ad7367ca9d32556cda02`.

## Find the public account ID

Open the chosen test account's installation snippet, or search the HTML of a
site where that account's CookieChimp widget is installed for
`cookiechimp.com/widget/`. For example:

```html
<script src="https://cookiechimp.com/widget/abc123.js"></script>
```

Here the public account ID is `abc123`. Enter only the ID, without the URL,
`/widget/` or `.js`. The example above is illustrative. Do not use an API key.

## Test account setup

- A dedicated test account's public hashid from its installation snippet. Do not
  supply an API key, password, session cookie or production visitor data.
- The full test-page origin, including scheme and port, allowed by that account.
  The workspace example defaults to `http://127.0.0.1:3104`; `localhost` is a
  different origin. If local origins are unsupported, use an approved preview
  origin and serve the same built example there.
- Use an origin already allowed by the selected account. For the completed
  `K8ktWD` test, `localhost` was already allowed and the page used
  `http://localhost:3104`. For another account, Daniel can allow the required
  host under Account Settings > Additional Domains. Keep the same host and
  origin throughout a run; no account setting change was needed for this test.
- Confirmation that the account has an active English opt-in banner for Ireland,
  with at least one optional category and a service. The example supplies `IE`
  and `en`; select or configure a test account accordingly.
  Prefer two optional categories so the custom case can enable one and reject
  another.
- Access to view that account's consent records in the dashboard. Daniel owns
  platform configuration and selects the account for live submissions. On
  24 October he authorized testing with `K8ktWD`; the SDK browser test submitted
  four decisions to that account. No platform repository or account settings
  were changed.

## Prepare the page

From the reviewed release checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cookiechimp/example-react-vite... build
pnpm --filter @cookiechimp/example-react-vite start
```

Open `http://127.0.0.1:3104/connected`, enter the public account ID and choose
**Load CookieChimp configuration**. In browser DevTools, preserve the Network log
and filter for `mobile-sdk`. For each sync request, the Payload tab contains
`consents[].client_id` and `consents[].uuid`; the Response tab contains `synced`.
Search the dashboard's Consent Records for `uuid` to confirm storage. The local
page's acknowledgement message must agree with the response for that decision.
Do not use `/platform.html` for this test: that
playground intentionally does not send consent records.

## Run the live cases

1. **Live config:** confirm the actual `GET /api/v1/mobile-sdk/offline/{accountId}`
   succeeds and the page reports a dashboard banner ID and config version.
   Retain the first 200 response, then check revalidation on reload. Cached
   fallback alone is not live proof. Record the selected banner and config version.
2. **Accept:** accept all optional categories. In the actual POST to
   `/api/v1/mobile-sdk/sync/{accountId}`, record the test decision's `client_id`
   and `uuid`. Require a successful response containing that same `client_id`
   in `synced`, and verify the corresponding test record in the platform.
3. **Reject:** reopen preferences and reject optional categories. Verify the
   decision values, matching receipt and platform record again.
4. **Custom:** choose a mixture of allowed and denied optional choices (if the
   test config exposes multiple), save and verify the payload, matching receipt
   and platform record. Required categories must remain enabled.
5. **Persistence:** reload after the custom decision. Confirm the choices and
   consent UUID restore from the account's cookie without prompting again.
6. **Retry:** after config is loaded, right-click an earlier sync request in
   Chrome's Network panel and choose **Block request**. In the **Request
   conditions** drawer, confirm the pattern blocks only the sync URL, not all
   CookieChimp requests. Keep DevTools open; closing it disables blocking.
   Save a changed decision; confirm a queued delivery without a success
   acknowledgement. Uncheck that blocking condition, toggle offline/online if needed, and
   wait for retry. Confirm the same queued `client_id` is acknowledged, the queue
   drains and the platform has one record for that retry ID. Do not delete local
   storage while the queued record is pending.

Chrome documents the current controls in
[Request conditions](https://developer.chrome.com/docs/devtools/request-conditions).

A 2xx response, displayed UUID or empty queue without a matching receipt is not
delivery proof. Keep `client_id` (delivery/retry identity) distinct from `uuid`
(visitor consent identity). If a case fails, preserve the redacted request and
response and leave the release gate pending.

## Evidence to return

Return a short test record with SDK version, full source SHA, UTC test time,
test origin, public test account ID, banner ID/config version and the six case
results above. For each submitted decision include the action, minimal category
values, `client_id`, `uuid`, HTTP status, matching `synced` entry and platform
record confirmation. A cropped dashboard screenshot can supply that confirmation.
Exclude API keys, browser cookies, IP addresses, device identifiers and unrelated
visitors. Do not commit a raw HAR or an authenticated dashboard export.

After review, add the sanitized evidence under `docs/release-evidence/`, update
`release/readiness.json` with its location and set `platformDeployed` true. Then
request Daniel's explicit approval to publish 1.1.0 and his `npm-publish`
environment approval. Approval of 1.0.0 does not approve 1.1.0.
