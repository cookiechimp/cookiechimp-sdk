# CookieChimp Consent SDK

Open-source, lightweight consent SDK for React, Next.js and plain JavaScript, built by CookieChimp.

- Works with no account (local mode).
- Connect a CookieChimp project to sync a consent log, scanner categories, dashboard-managed copy, translations, regional rules and styling, plus IAB TCF/GPP and multi-site.
- Small, fast, no banner flash on SSR, strict CSP friendly, Google Consent Mode v2 ready.

Status: pre-alpha. See [SPEC.md](./SPEC.md) for the design and roadmap.

License: MIT

## Region and regulation behavior

Import `resolveRegion`, `regulationFor`, and the server header form of
`readGpc` from `@cookiechimp/core/regions`. `resolveRegion(headers, options)`
accepts Web `Headers`, plain records, and
Node-style incoming header records. The `provider` option is required to trust
geo headers and must be `"vercel"`, `"cloudflare"`, `"cloudfront"`, or
`"custom"`. Only that provider's country and subdivision headers are read.
Custom providers use `header` and optional `regionHeader` names. There is no
generic geo header fallback. Country and subdivision values are normalized to
uppercase. Unknown and malformed provider values are ignored.

The default rules treat the EU and EEA, the UK, and Switzerland as GDPR.
California and the other states listed by `US_OPT_OUT_STATES` use a common
CCPA-style opt-out behavior. This behavior model does not imply that the state
statutes are identical. Unknown locations use the safe GDPR fallback. Pass the
result into the default entry as already-resolved context:

```ts
import { createConsent } from "@cookiechimp/core";
import { regulationFor, resolveRegion } from "@cookiechimp/core/regions";

const region = resolveRegion(headers, { provider: "vercel" });
const consent = createConsent({
  categories: ["analytics", "advertising"],
  region,
  resolveRegulation: regulationFor,
  gpc: true,
});
```

`regulation` may also be a resolver function. Prefer `resolveRegulation` when
passing region context. Without either option, `createConsent` uses
`fallbackRegulation`, which defaults to `"gdpr"`, and warns in development
when a region was supplied. `regions` remains available for application-specific
overrides.

GDPR starts non-required categories disabled and requires a decision. CCPA
starts them enabled and exposes an opt-out link. GPC disables the configured
sale/share categories, which default to `advertising` and `marketing`, even
when a stored decision enabled them. Other parts of an explicit stored user
decision remain authoritative. Locations with no rule use category defaults
and require no decision unless `forceDecision` is enabled.

The compact built-in country and state table is available from
`@cookiechimp/core/regions`. No network lookup occurs. Server applications can
pass the resolved `region` and `gpc` into `createConsent` so server and browser
rendering use the same context.
