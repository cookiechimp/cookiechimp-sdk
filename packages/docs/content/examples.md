# Examples

Runnable apps live in [`examples/`](../../../examples/nextjs-app-router/README.md).
Both are built and tested end to end in CI on every pull request.

| Example | Shows |
|---|---|
| `examples/nextjs-app-router` | `CookieChimpProvider` (server), banner, preferences, recall button, a gated GA4 tag, `useCategory`. |
| `examples/nextjs-pages-router` | `withConsent` and `PagesConsentProvider` with the same UI. |

```sh
pnpm install
pnpm --filter @cookiechimp/example-nextjs-app-router... build
pnpm --filter @cookiechimp/example-nextjs-app-router start
```

Outside the monorepo, replace the `workspace:*` versions with published ones.
