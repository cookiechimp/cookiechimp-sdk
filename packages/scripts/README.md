# `@cookiechimp/scripts`

Tree-shakeable Google script presets for CookieChimp. Import only the integration you use.

```ts
import { applyPresets } from "@cookiechimp/scripts";
import { ga4 } from "@cookiechimp/scripts/ga4";
import { gtm } from "@cookiechimp/scripts/gtm";
import { googleAds } from "@cookiechimp/scripts/google-ads";

const presets = [
  ga4({ measurementId: "G-EXAMPLE" }),
  googleAds({ conversionId: "AW-EXAMPLE" }),
  gtm({ containerId: "GTM-EXAMPLE", category: "analytics" }),
];
const config = applyPresets({ categories: ["analytics", "marketing"] }, presets);
```

Render each preset's `script.attributes` on a script element, then run `gateScripts` from `@cookiechimp/core/gate`. The attributes use `data-cc-src`, `data-cc-category`, and `data-cc-service`, so no gated request starts before consent. Pass the resulting config to `blockDynamic` from `@cookiechimp/core/dynamic` as well if third-party code can create scripts.

Call `preset.queue.install(window)` before application code can call `gtag`. It preserves early calls in the selected data layer. Pass `config.consentMode` to `installConsentMode` from `@cookiechimp/core/consent-mode`.

GTM uses basic consent mode by default and is gated. With `consentMode: "advanced"`, GTM loads immediately and installing its queue first writes denied Consent Mode v2 defaults before the loader is inserted.
