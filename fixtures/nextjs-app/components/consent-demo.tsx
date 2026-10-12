"use client";

import { createConsent } from "@cookiechimp/core";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { useEffect, useState } from "react";

const consent = createConsent({
  categories: { analytics: false },
  services: [
    {
      id: "analytics-demo",
      category: "analytics",
      domains: ["dynamic.cookiechimp.test"],
    },
  ],
});

export function ConsentDemo() {
  const [accepted, setAccepted] = useState(false);
  const [serviceAccepted, setServiceAccepted] = useState(false);

  useEffect(() => {
    const gate = gateScripts(consent);
    const dynamic = blockDynamic(consent, {
      config: {
        categories: ["analytics"],
        services: [
          {
            id: "analytics-demo",
            category: "analytics",
            domains: ["dynamic.cookiechimp.test"],
          },
        ],
      },
    });
    setAccepted(consent.has("analytics"));
    setServiceAccepted(consent.hasService("analytics-demo"));
    const unsubscribe = consent.subscribe((state) => {
      setAccepted(state.categories.analytics === true);
      setServiceAccepted(consent.hasService("analytics-demo"));
    });
    return () => {
      gate.stop();
      dynamic.stop();
      unsubscribe();
    };
  }, []);

  return (
    <section aria-label="Consent demo">
      <p data-testid="consent-status">
        {accepted ? "Analytics accepted" : "Analytics declined"}
      </p>
      <button type="button" onClick={() => consent.acceptAll()}>
        Accept all cookies
      </button>
      <p data-testid="service-status">
        {serviceAccepted
          ? "Analytics demo accepted"
          : "Analytics demo declined"}
      </p>
      <button
        type="button"
        onClick={() =>
          consent.set({
            services: {
              "analytics-demo": !consent.hasService("analytics-demo"),
            },
          })
        }
      >
        Toggle analytics demo
      </button>
      <div data-testid="gated-elements">
        <script type="text/plain" data-cc-category="analytics">
          {"window.__ccAnalyticsRan = true;"}
        </script>
        <iframe
          title="Gated local frame"
          data-cc-src="/frame"
          data-cc-category="analytics"
        />
      </div>
    </section>
  );
}
