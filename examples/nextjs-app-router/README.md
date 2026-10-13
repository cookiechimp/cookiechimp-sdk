# CookieChimp example: Next.js app-router

A minimal Next.js app with the CookieChimp banner, preferences, a recall button
and a GA4 tag that stays blocked until analytics consent.

```sh
pnpm install
pnpm --filter @cookiechimp/example-nextjs-app-router build
pnpm --filter @cookiechimp/example-nextjs-app-router start   # http://127.0.0.1:3101
```

Outside this monorepo, replace the `workspace:*` versions in `package.json`
with the published `@cookiechimp` versions.
