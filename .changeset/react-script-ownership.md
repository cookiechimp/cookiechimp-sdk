---
"@cookiechimp/core": patch
"@cookiechimp/react": patch
"@cookiechimp/cli": patch
"@cookiechimp/nextjs": patch
---

Keep React-owned gated script nodes stable through activation and reconciliation. Prevent duplicate execution across gate controllers and recheck consent before queued scripts execute. Generate CLI configurations that pass TypeScript.

Decode filesystem URLs when generating Next.js critical CSS so builds work in paths with spaces.
