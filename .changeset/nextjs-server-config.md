---
"@cookiechimp/nextjs": minor
---

Fetch the dashboard config on the server: `getServerConfig` and a `projectId` prop on `CookieChimpProvider` (Next.js data cache, `revalidate: 300`), so SSR markup already has the dashboard categories and copy. Falls back to the code config on any failure.
