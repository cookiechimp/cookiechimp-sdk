import type { ConsentConfig } from "@cookiechimp/core";
import { applyPresets } from "@cookiechimp/scripts";
import { clarity } from "@cookiechimp/scripts/clarity";
import { ga4 } from "@cookiechimp/scripts/ga4";
import { googleAds } from "@cookiechimp/scripts/google-ads";
import { gtm } from "@cookiechimp/scripts/gtm";
import { hotjar } from "@cookiechimp/scripts/hotjar";
import { linkedin } from "@cookiechimp/scripts/linkedin";
import { metaPixel } from "@cookiechimp/scripts/meta-pixel";
import { posthog } from "@cookiechimp/scripts/posthog";
import { segment } from "@cookiechimp/scripts/segment";
import { tiktok } from "@cookiechimp/scripts/tiktok";

/** Fixture vendor presets, shared by the config and the /vendors page. */
export function vendorPresets() {
  return [
    metaPixel({ pixelId: "123456789012345" }),
    clarity({ projectId: "ccfixture1" }),
    posthog({ apiKey: "phc_cookiechimpfixture0123456789abcdef" }),
    segment({ writeKey: "CookieChimpFixture0123456789abcd" }),
    hotjar({ siteId: "1234567" }),
    linkedin({ partnerId: "123456" }),
    tiktok({ pixelId: "CCFIXTURE01234567890" }),
  ];
}

export const consentConfig = applyPresets(
  {
    categories: { analytics: false, advertising: false, marketing: false },
    regulation: "gdpr",
    services: [
      {
        id: "analytics-demo",
        category: "analytics",
        domains: ["dynamic.cookiechimp.test"],
      },
    ],
    saleShareCategories: ["advertising"],
  } satisfies ConsentConfig,
  [
    ga4({ measurementId: "G-COOKIECHIMP" }),
    gtm({ containerId: "GTM-COOKIECHIMP", category: "analytics" }),
    googleAds({ conversionId: "AW-COOKIECHIMP" }),
    ...vendorPresets(),
  ],
);
