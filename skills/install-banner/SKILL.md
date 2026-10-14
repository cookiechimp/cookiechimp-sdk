---
name: install-banner
description: Add the CookieChimp consent SDK and a cookie banner to a Next.js (App or Pages Router), React or plain JavaScript app. Use when asked to add a cookie banner, cookie consent, a GDPR or CCPA consent prompt, or CookieChimp to a project.
---

# Install the CookieChimp banner

## Steps

1. Detect the framework from `package.json` and the folders (`app/` is the
   Next.js App Router, `pages/` is the Pages Router).
2. Prefer the CLI. It installs packages and writes starter files, and never
   overwrites existing files:

   ```sh
   npx @cookiechimp/cli init --dry-run   # show the plan first
   npx @cookiechimp/cli init
   ```

3. Apply the one manual step it prints, such as wrapping the root layout.
4. Run `npx @cookiechimp/cli doctor` and fix anything it reports.

## Manual setup (Next.js App Router)

```tsx
// app/layout.tsx
import "@cookiechimp/react/styles.css";
import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { CookieChimpBanner } from "../components/cookiechimp-banner";
import { consentConfig } from "../cookiechimp.config";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CookieChimpProvider config={consentConfig}>
          {children}
          <CookieChimpBanner />
        </CookieChimpProvider>
      </body>
    </html>
  );
}
```

`components/cookiechimp-banner.tsx` is a `"use client"` file that renders
`<CookieBanner />` from `@cookiechimp/react/banner`. React apps use
`ConsentProvider` from `@cookiechimp/react` instead of `CookieChimpProvider`.

## Rules

- Categories other than `necessary` must default to `false` for GDPR.
- Never add geo-IP lookups. For regional rules, pass headers from the host
  (`resolveRegion(headers, { provider: "vercel" })` from
  `@cookiechimp/core/regions`) or `provider="vercel"` on the provider.
- Keep the provider in a server component in the App Router so the banner does
  not flash.
- Under a strict Content Security Policy, pass the request nonce to
  `CookieChimpStyles`, `GoogleConsentMode` and `GppStub`.
- Then use the `gate-scripts` skill for any analytics or ad tags.

Docs: https://docs.cookiechimp.com/docs/sdk/getting-started
AI index: https://docs.cookiechimp.com/docs/llms.txt
