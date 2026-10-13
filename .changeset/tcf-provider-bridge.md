---
"@cookiechimp/react": minor
"@cookiechimp/nextjs": minor
---

Add an opt-in TcfProvider in its own lazy subpath and a server TcfStub helper. Bind the controller to the existing consent runtime, publish readiness to the caller, fail closed on invalid CMP/GVL configuration and clean up pending loads and subscriptions on unmount.
