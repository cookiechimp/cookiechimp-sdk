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
