# `@cookiechimp/scripts`

Tree-shakeable analytics and advertising script presets for CookieChimp. Import only the integration you use.

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

GTM uses basic consent mode by default and is gated. With `consentMode: "advanced"`, GTM loads immediately and installing its queue first writes denied Consent Mode v2 defaults before the loader is inserted. GTM adds no Consent Mode mapping of its own: `analytics_storage` follows the analytics category and the ad signals follow the marketing category, whichever category gates the container.

## Other vendors

Each vendor has its own opt-in subpath, so nothing ships unless you import it:

| Import | Option | ID format | Default category | Loader origin |
| --- | --- | --- | --- | --- |
| `@cookiechimp/scripts/meta-pixel` | `pixelId` | 15 or 16 digits | marketing | `https://connect.facebook.net` |
| `@cookiechimp/scripts/clarity` | `projectId` | 10 lowercase letters or digits | analytics | `https://www.clarity.ms` |
| `@cookiechimp/scripts/posthog` | `apiKey`, `region` (`us` or `eu`) | `phc_` then 20 to 64 letters or digits | analytics | `https://us-assets.i.posthog.com` or `https://eu-assets.i.posthog.com` |
| `@cookiechimp/scripts/segment` | `writeKey` | 32 letters or digits | analytics | `https://cdn.segment.com` |
| `@cookiechimp/scripts/hotjar` | `siteId` | 5 to 10 digits | analytics | `https://static.hotjar.com` |
| `@cookiechimp/scripts/linkedin` | `partnerId` | 4 to 10 digits | marketing | `https://snap.licdn.com` |
| `@cookiechimp/scripts/tiktok` | `pixelId` | 20 uppercase letters or digits | marketing | `https://analytics.tiktok.com` |

All of them are gated: the loader script is inert (`type="text/plain"`) until its category is granted. `preset.queue.install(window)` only creates the vendor's queue global (`fbq`, `clarity`, `posthog`, `analytics`, `hj`, `lintrk`, `ttq`) so early calls are kept; it never inserts a script or sends a request.

IDs are checked against a strict pattern and encoded before they are placed in a URL, and loader URLs always use the fixed origin above. PostHog and Segment accept a custom `globalName`, which must be a plain identifier. Invalid values throw in development and warn in production, where the preset falls back to its default global name or region.

These vendors do not read Google Consent Mode, so they add no Consent Mode mapping. Google signals keep following core's categories and defaults.
