"use client";

import { type ConsentState, createConsent } from "@cookiechimp/core";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { blockNetwork } from "@cookiechimp/core/network";
import {
  ConsentProvider,
  useBanner,
  useCategory,
  useConsentActions,
} from "@cookiechimp/react";
import { useEffect, useState } from "react";

const config = {
  categories: { analytics: false },
  regulation: "gdpr" as const,
  services: [
    {
      id: "analytics-demo",
      category: "analytics",
      domains: ["dynamic.cookiechimp.test"],
    },
  ],
};

export function ConsentDemo({
  initialState = null,
}: {
  initialState?: ConsentState | null;
}) {
  const [consent] = useState(() =>
    createConsent({ ...config, initial: initialState }),
  );
  return (
    <ConsentProvider consent={consent} initialState={initialState}>
      <ConsentDemoContent consent={consent} />
    </ConsentProvider>
  );
}

function ConsentDemoContent({
  consent,
}: {
  consent: ReturnType<typeof createConsent>;
}) {
  const accepted = useCategory("analytics");
  const { acceptAll, set } = useConsentActions();
  const banner = useBanner();

  useEffect(() => {
    const gate = gateScripts(consent);
    const dynamic = blockDynamic(consent, { config });
    const network = blockNetwork(consent, { config });
    document.documentElement.dataset.ccDynamic = "ready";
    document.documentElement.dataset.ccNetwork = "ready";
    return () => {
      delete document.documentElement.dataset.ccDynamic;
      delete document.documentElement.dataset.ccNetwork;
      gate.stop();
      dynamic.stop();
      network.stop();
    };
  }, [consent]);

  return (
    <section aria-label="Consent demo">
      {banner.open && (
        <aside data-testid="consent-banner">Cookie preferences</aside>
      )}
      <p data-testid="consent-status">
        {accepted ? "Analytics accepted" : "Analytics declined"}
      </p>
      <button type="button" onClick={acceptAll}>
        Accept all cookies
      </button>
      <p data-testid="service-status">
        {consent.hasService("analytics-demo")
          ? "Analytics demo accepted"
          : "Analytics demo declined"}
      </p>
      <button
        type="button"
        onClick={() =>
          set({
            services: {
              "analytics-demo": !consent.hasService("analytics-demo"),
            },
          })
        }
      >
        Toggle analytics demo
      </button>
      <div data-testid="gated-elements">
        <button
          type="button"
          onClick={() => {
            const url = "https://dynamic.cookiechimp.test/collect";
            void fetch(url).catch(() => {});
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            xhr.send();
            navigator.sendBeacon(url, "demo");
          }}
        >
          Send tracker requests
        </button>
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
