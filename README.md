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

## Script and iframe gating

The opt-in `@cookiechimp/core/gate` subpath provides declarative script and
iframe gating. Call `gateScripts(consent)` after creating a consent runtime.
Declarative scripts use `type="text/plain"` with `data-cc-category` and optional
`data-cc-service`; gated frames use `data-cc-src` instead of `src`. The
controller scans later DOM additions and exposes `scan()`, `blocked()`, and
`stop()`.

Use `blockDynamic(consent, { config })` from `@cookiechimp/core/dynamic` to
block runtime-added resources that match a configured service. This runtime
entry intercepts source assignments and DOM insertion APIs. Gate alone observes
declarative markup, but cannot prevent a third-party plain `src` assignment
before the browser starts it. Revocation cannot undo
code that has already run. By default it leaves activated resources in place.
Use `onRevoke` to notify the application, or `reloadOnRevoke: true` when a page
reload is the desired policy. Core invokes the optional iframe `placeholder`
hook but deliberately provides no placeholder styling.

### Install order for runtime blocking

`blockDynamic` only protects requests that start after it is installed. Install
it before any third-party code runs: as the first module script in `<head>`,
before tag managers or embeds. Installing it from a React effect or after
hydration leaves a window in which a plain `src` assignment can start a
request. Interceptors are active as soon as `blockDynamic` returns (the test
fixture then sets `data-cc-dynamic="ready"` on `<html>` so e2e tests can wait
for it).

```html
<head>
  <script type="module">
    import { createConsent } from "/vendor/cookiechimp/core/index.mjs";
    import { blockDynamic } from "/vendor/cookiechimp/core/dynamic.mjs";
    const config = { categories: ["analytics"], services: [/* ... */] };
    blockDynamic(createConsent(config), { config });
  </script>
  <!-- third-party scripts after this point -->
</head>
```

A prebuilt inline (IIFE) head snippet and a Next.js `beforeInteractive`
helper are planned with the M3 Next.js package.

## Network blocking

The opt-in `@cookiechimp/core/network` subpath blocks `fetch`, XMLHttpRequest,
and `navigator.sendBeacon` calls whose URL or host matches a configured service
without consent. Install `blockNetwork(consent, { config })` before tracker code
runs. Consent is checked for every request, so later grants take effect and
later revocations block again. Relative URLs resolve against `document.baseURI`.
Non-HTTP URLs and URLs that cannot be parsed are left alone.

Blocked requests are dropped, not queued or replayed. This is the safer privacy default: a request made before consent may carry data the visitor never agreed to share, and replaying it later would send that data anyway. Code that needs the request after consent should make it again from a consent subscriber.

Blocked fetch calls reject with `ConsentBlockedError`. Blocked XHR sends behave like a network error: `readyState` is 4, status is 0,
and `readystatechange`, `error`, and `loadend` fire asynchronously as
ProgressEvents. `ConsentBlockedError` extends `TypeError`, like a native fetch
network failure. Blocked beacons return `false`. Requests are
dropped and are never queued or replayed. The returned controller provides
`blocked()` reports and `stop()` to release its shared, reference-counted
patches.

Limitations of `./network`:

- `fetch` or XMLHttpRequest references captured before `blockNetwork` runs are
  not covered. Install it before any third-party code.
- Code running in iframes or workers is not covered, since each has its own
  globals.
- Image pixels, WebSocket, and EventSource requests are not covered. An image
  pixel handler for `./dynamic` is on the backlog.
