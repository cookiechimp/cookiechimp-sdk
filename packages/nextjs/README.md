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
