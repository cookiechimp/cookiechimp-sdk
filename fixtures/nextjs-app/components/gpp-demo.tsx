"use client";

import { type ConsentRuntime, createConsent } from "@cookiechimp/core";
import { regulationFor } from "@cookiechimp/core/regions";
import { useEffect, useState } from "react";

export function GppDemo({
  region,
  national,
}: {
  region?: string;
  national: boolean;
}) {
  const [runtime, setRuntime] = useState<ConsentRuntime | null>(null);
  useEffect(() => {
    const consent = createConsent({
      categories: { advertising: false, marketing: false },
      cookie: { name: "cc_gpp_fixture" },
      region: region ? { country: "US", region } : { country: "IE" },
      resolveRegulation: regulationFor,
    });
    let stop = () => {};
    let active = true;
    // The GPP module loads lazily, after hydration, like a real deployment.
    import("@cookiechimp/core/gpp").then(({ installGpp }) => {
      if (!active) return;
      stop = installGpp(consent, {
        approach: national ? "national" : "state",
        values: {
          usnat: { SaleOptOutNotice: 1 },
          usca: { SaleOptOutNotice: 1 },
        },
      }).stop;
      document.documentElement.dataset.ccGpp = "ready";
    });
    setRuntime(consent);
    return () => {
      active = false;
      stop();
      delete document.documentElement.dataset.ccGpp;
    };
  }, [region, national]);
  return (
    <div>
      <button type="button" onClick={() => runtime?.rejectAll()}>
        Opt out of sale
      </button>
      <button type="button" onClick={() => runtime?.acceptAll()}>
        Allow sale
      </button>
    </div>
  );
}
