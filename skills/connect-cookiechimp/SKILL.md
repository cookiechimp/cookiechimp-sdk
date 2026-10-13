---
name: connect-cookiechimp
description: Connect a site that uses the CookieChimp SDK in local mode to a CookieChimp project, for the consent log, scanner categories, dashboard copy, translations, regional rules and styling. Use when asked to link CookieChimp, add a projectId, or pull dashboard config.
---

# Connect to a CookieChimp project

Connected mode needs a CookieChimp account and project. Never ask for, paste,
log or commit API tokens or passwords.

## Steps

1. The developer creates a dashboard API token and runs `link` themselves.
   The token is read only from the environment or stdin, never from
   arguments, and is never written to disk or printed. Do not handle the
   token yourself:

   ```sh
   COOKIECHIMP_API_TOKEN=... npx @cookiechimp/cli link
   ```

   It lists the account's sites and writes the chosen project ID to
   `.env.local` (`NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID` for Next.js). The
   project ID is a public value that ships to the browser.
2. Pass the project ID to the provider. Keep the code config as the fallback:

   ```tsx
   import { CookieChimpProvider } from "@cookiechimp/nextjs/server";

   <CookieChimpProvider
     projectId={process.env.NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID}
     config={consentConfig}
   >
     {children}
   </CookieChimpProvider>;
   ```

3. Optional: `npx @cookiechimp/cli pull` downloads the public dashboard config
   to `cookiechimp.config.json` for offline or reproducible builds. No token
   is sent.

## Behaviour to keep in mind

- Precedence: code `override`, then the dashboard, then code defaults.
- If the platform is unreachable, the banner renders from the code config. The
  SDK never breaks a site because of billing or quota.
- Tier limits are enforced on the server, not in the SDK.
- Without an account, local mode can still send records to your own route with
  `endpoint="/api/consent"`.
