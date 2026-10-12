# CookieChimp for Next.js

`@cookiechimp/nextjs` provides an App Router server provider that renders the
correct consent UI in the initial HTML and seeds the client with the same
state.

## Region handling

CookieChimp never looks up a visitor's location. The SDK performs no geo-IP,
IP address, browser geolocation, or external location-service request. Your
application must decide which trusted location context to use.

You can pass a region directly to `CookieChimpProvider` and
`getServerConsent`. If your hosting platform already adds geo headers, read
those headers in the App Router and resolve them locally. Vercel uses
`x-vercel-ip-country` and `x-vercel-ip-country-region`. Cloudflare uses
`cf-ipcountry`. `resolveRegion` only parses the headers you give it and never
makes a network request.

```tsx
// app/layout.tsx
import { resolveRegion } from "@cookiechimp/core/regions";
import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { headers } from "next/headers";

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const region = resolveRegion(requestHeaders, { provider: "vercel" });

  return (
    <html lang="en">
      <body>
        <CookieChimpProvider
          config={{ categories: ["analytics", "advertising"] }}
          region={region}
        >
          {children}
        </CookieChimpProvider>
      </body>
    </html>
  );
}
```

The `provider="vercel"` or `provider="cloudflare"` shorthand is also
available on the provider when it is preferable for the provider itself to
read the request headers. Passing an explicit `region` keeps ownership visible
in application code.

## Pages Router

Use `withConsent` to add the server cookie, normalized region, and negotiated
language to `getServerSideProps`. Wrap the page in `PagesConsentProvider`,
either locally or from `pages/_app`, so the browser hydrates the exact server
snapshot.

```tsx
import { PagesConsentProvider, withConsent } from "@cookiechimp/nextjs/pages";

export const getServerSideProps = withConsent({
  config,
  provider: "vercel",
  languages: { available: ["en", "de"], fallback: "en" },
});

export default function Page({ cookiechimp }) {
  return <PagesConsentProvider config={config} {...cookiechimp}>...</PagesConsentProvider>;
}
```

An existing `getServerSideProps` can be passed as the second argument. The
`withConsentPage` HOC is available when wrapping the individual component is
more convenient.

## Middleware region forwarding

The middleware helper only parses headers already provided by the selected
host. It does not perform geo-IP, fetch, or any external lookup. Selecting a
provider is required, which prevents arbitrary provider headers from being
trusted by accident. Any incoming `x-cc-region` is removed before the trusted
value is written.

```ts
import { consentMiddleware } from "@cookiechimp/nextjs/middleware";

export function middleware(request) {
  return consentMiddleware(request, { provider: "cloudflare" });
}
```

`getServerConsent`, `CookieChimpProvider`, and the Pages helpers automatically
read the forwarded `x-cc-region` request header. Use `provider: "custom"` with
`header` to opt in to a host-specific country header.

## Strict CSP stylesheet

For a policy such as `style-src 'self'`, expose a same-origin Route Handler and
load it with a stylesheet link instead of rendering `CookieChimpStyles`.

```ts
// app/cookiechimp.css/route.ts
import { stylesRoute } from "@cookiechimp/nextjs/styles-route";
export const GET = stylesRoute;
```

`CookieChimpStyles` and `GoogleConsentMode` accept a `nonce` prop for CSP
policies that allow nonce-bearing inline styles or scripts. For a policy that
does not allow inline styles, use `stylesRoute` and link to the route instead.

```tsx
<link rel="stylesheet" href="/cookiechimp.css" />
```

The response includes `text/css`, immutable one-year caching, and a stable
ETag. Conditional requests return 304.

## Strict Content Security Policy

`CookieChimpStyles` renders an inline style and `GoogleConsentMode` renders an
inline script. Under a strict Content Security Policy, pass the same per-request
nonce to both components. One approach is to generate the nonce in middleware,
include it in the policy, and copy it to a request header:

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}
```

Read the middleware header in the App Router layout and pass the nonce to each
inline element:

```tsx
// app/layout.tsx
import {
  CookieChimpProvider,
  CookieChimpStyles,
  GoogleConsentMode,
} from "@cookiechimp/nextjs/server";
import { headers } from "next/headers";

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      <head>
        <CookieChimpStyles nonce={nonce} />
        <GoogleConsentMode nonce={nonce} />
      </head>
      <body>
        <CookieChimpProvider config={{ categories: ["analytics"] }}>
          {children}
        </CookieChimpProvider>
      </body>
    </html>
  );
}
```
