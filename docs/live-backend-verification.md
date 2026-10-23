# Live backend verification for SDK 1.1.0

Status: deferred by Daniel on 23 October 2026. This is still a publication gate.
Mocked CI, a successful deployment and local consent persistence do not satisfy it.
Keep `manualChecks.platformDeployed` false until real evidence is reviewed.

## Information Daniel supplies when testing resumes

- A dedicated test account's public hashid from its installation snippet. Do not
  supply an API key, password, session cookie or production visitor data.
- The full test-page origin, including scheme and port, allowed by that account.
  The workspace example defaults to `http://127.0.0.1:3104`; `localhost` is a
  different origin. If local origins are unsupported, use an approved preview
  origin and serve the same built example there.
- Confirmation that the account has an active English opt-in banner for Ireland,
  with at least one optional category and a service. The example supplies `IE`
  and `en`; select or configure a test account accordingly.
- Access to view that account's consent records in the dashboard. Daniel performs
  platform configuration and the live consent submissions; SDK preparation does
  not modify the platform or post records on his behalf.

## Prepare the page

From the reviewed release checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cookiechimp/example-react-vite... build
pnpm --filter @cookiechimp/example-react-vite start
```

Open `http://127.0.0.1:3104/connected`, enter the public account ID and choose
**Load CookieChimp configuration**. In browser DevTools, preserve the Network log
and filter for `mobile-sdk`. Do not use `/platform.html` for this test: that
playground intentionally does not send consent records.

## Daniel runs the live cases

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
6. **Retry:** after config is loaded, use DevTools request blocking to block only
   the sync URL. Save a changed decision; confirm a queued delivery without a
   success acknowledgement. Unblock it, toggle offline/online if needed, and
   wait for retry. Confirm the same queued `client_id` is acknowledged, the queue
   drains and the platform has one record for that retry ID. Do not delete local
   storage while the queued record is pending.

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
