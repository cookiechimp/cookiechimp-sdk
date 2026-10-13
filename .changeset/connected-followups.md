---
"@cookiechimp/core": patch
"@cookiechimp/nextjs": minor
---

Next.js connected mode now applies the dashboard cookie name and expiry on the server and revalidates the config in the browser after hydration. `createSync` gains an `etag` seed option and no longer lets a busy page postpone revalidation indefinitely (idle callback timeout).
