"use client";

import { createConsent } from "@cookiechimp/core";
import { useEffect, useState } from "react";

const consent = createConsent({ categories: { analytics: false } });

export function ConsentDemo() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(consent.has("analytics"));
    return consent.subscribe((state) =>
      setAccepted(state.categories.analytics === true),
    );
  }, []);

  return (
    <section aria-label="Consent demo">
      <p data-testid="consent-status">
        {accepted ? "Analytics accepted" : "Analytics declined"}
      </p>
      <button type="button" onClick={() => consent.acceptAll()}>
        Accept all cookies
      </button>
    </section>
  );
}
