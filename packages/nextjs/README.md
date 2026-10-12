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

```tsx
<link rel="stylesheet" href="/cookiechimp.css" />
```

The response includes `text/css`, immutable one-year caching, and a stable
ETag. Conditional requests return 304.
