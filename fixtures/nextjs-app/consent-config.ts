import type { ConsentConfig } from "@cookiechimp/core";
import { applyPresets } from "@cookiechimp/scripts";
import { ga4 } from "@cookiechimp/scripts/ga4";
import { googleAds } from "@cookiechimp/scripts/google-ads";
import { gtm } from "@cookiechimp/scripts/gtm";

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
  ],
);
