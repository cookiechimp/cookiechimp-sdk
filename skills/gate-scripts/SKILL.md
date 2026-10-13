---
name: gate-scripts
description: Make analytics, advertising and embed scripts wait for cookie consent with CookieChimp (GA4, GTM, Google Ads, Meta Pixel, Clarity, PostHog, Segment, Hotjar, LinkedIn, TikTok, iframes), including Google Consent Mode v2. Use when tags load before consent or when adding a tracking script to a site that uses CookieChimp.
---

# Gate scripts behind consent

## Find what loads today

Search for tracking tags: `gtag/js`, `googletagmanager.com`, `fbevents.js`,
`clarity.ms`, `posthog`, `segment.com`, `hotjar`, `licdn.com`, `tiktok`, and
`<iframe` embeds such as YouTube or Maps. `npx @cookiechimp/cli doctor` flags
known tracking tags that are not gated.

## Use a preset

```ts
import { applyPresets } from "@cookiechimp/scripts";
import { ga4 } from "@cookiechimp/scripts/ga4";
import { metaPixel } from "@cookiechimp/scripts/meta-pixel";

export const ga = ga4({ measurementId: "G-EXAMPLE123" });
export const pixel = metaPixel({ pixelId: "123456789012345" });
export const consentConfig = applyPresets(
  { categories: { analytics: false, marketing: false } },
  [ga, pixel],
);
```

In React, render the loader with `GatedScript`:

```tsx
import { GatedScript } from "@cookiechimp/react/ui";

<GatedScript category={ga.category} service={ga.service.id} src={ga.script.src} async />;
```

Keep each `GatedScript` as the only child of an element whose children never
change (for example `<div hidden>`). Activation currently replaces the script
node, and React fails if it later re-renders siblings next to it.

Without React, render each preset's `script.attributes` on a `<script>` and
call `gateScripts(consent)` from `@cookiechimp/core/gate`. Gated scripts use
`type="text/plain"` and `data-cc-src`, so the browser makes no request before
consent.

## Also

- Iframes: `GatedFrame` from `@cookiechimp/react/ui`, or `data-cc-src` on the
  iframe with `gateScripts`.
- Third-party code that creates scripts at runtime: `blockDynamic(consent, { config })`
  from `@cookiechimp/core/dynamic`. Install it before vendor code runs.
- Google tags: render `GoogleConsentMode` (Next.js) or
  `consentModeInlineScript()` first in `<head>`, then call
  `installConsentMode(consent, config.consentMode)` from
  `@cookiechimp/core/consent-mode`.
- Revoking after load: call `preset.sync(consent)`. Presets with
  `revoke === "reload"` need a page reload to stop.

## Check

Use the `test-consent` skill to prove that no vendor request happens before consent.
