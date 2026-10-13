import type { ConsentConfig } from "@cookiechimp/core";
import { applyPresets } from "@cookiechimp/scripts";
import { ga4 } from "@cookiechimp/scripts/ga4";

/** Replace the measurement ID with your own. Edit categories to match your site. */
export const ga = ga4({ measurementId: "G-EXAMPLE123" });

export const consentConfig = applyPresets(
  {
    // "necessary" is added automatically and is always on.
    categories: { analytics: false, marketing: false },
  },
  [ga],
) satisfies ConsentConfig;
