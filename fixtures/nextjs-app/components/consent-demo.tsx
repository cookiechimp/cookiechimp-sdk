"use client";

import { createConsent } from "@cookiechimp/core";
import { useEffect, useState } from "react";

const consent = createConsent({
  categories: { analytics: false },
  services: [{ id: "analytics-demo", category: "analytics" }],
});

export function ConsentDemo() {
  const [accepted, setAccepted] = useState(false);
  const [serviceAccepted, setServiceAccepted] = useState(false);

  useEffect(() => {
    setAccepted(consent.has("analytics"));
    setServiceAccepted(consent.hasService("analytics-demo"));
    return consent.subscribe((state) => {
      setAccepted(state.categories.analytics === true);
      setServiceAccepted(consent.hasService("analytics-demo"));
    });
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
    </section>
  );
}
