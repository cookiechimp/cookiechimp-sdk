# React + Vite example

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
