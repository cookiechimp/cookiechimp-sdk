# React + Vite example

## Connect to the CookieChimp backend

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cookiechimp/example-react-vite... build
pnpm --filter @cookiechimp/example-react-vite start
```

Open `http://127.0.0.1:3104/connected` and enter your public CookieChimp account
ID from the installation snippet. Use a dedicated test account with an allowed
test origin. This page calls `https://cookiechimp.com` for dashboard configuration,
then displays the selected banner/version and renders its categories and copy.
Accept, reject or customize consent to send a record to the platform. Delivery
is confirmed only by a matching platform receipt, separately from config loading
and the pending queue count. Reloading restores the account's configured cookie.

The source is [`src/connected.tsx`](src/connected.tsx). It uses `createSync`,
`createConsent` and `createConsentLog` together, handles teardown and retries,
and never silently presents fallback config as a verified backend connection.
English and an explicit Ireland region are example application choices; replace
them with your own trusted context. No vendor tags run on this page.

The [backend guide](../../packages/docs/content/connected-backend.md) describes
requests, payloads, Next.js config loading and required live verification. CI
mocks every platform request, so browser tests never write to the live platform
and do not replace the required real-account release check.

## Local-only demonstration

A plain client-side React app with a banner, preferences, recall control and a
consent-gated script. It uses the real SDK packages and one runtime created
outside React renders. StrictMode is enabled. No Next.js dependency or browser
location lookup is used.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @cookiechimp/example-react-vite start
```

Open `http://127.0.0.1:3104`. Accept or reject analytics, reload, then reopen
preferences. The gated script increments `window.__exampleAnalyticsRuns` locally;
it makes no third-party requests. Consent persists in the SDK cookie.

For development, build the SDK packages first, then run
`pnpm --filter @cookiechimp/example-react-vite dev`. The example uses Vite 8 and
requires Node 22.12+ or Node 24 for this workspace. Vite itself also supports
Node 20.19+ for standalone app builds.

To copy the app out of this monorepo after npm publication, replace the two
`workspace:*` SDK dependencies with their published versions and remove the
relative `extends` from tsconfig.json, keeping the compiler options from the root
`tsconfig.base.json`. Build with `pnpm build`; deploy `dist/` to a static host.
There is no server-side consent state in this example.
