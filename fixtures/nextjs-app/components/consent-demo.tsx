"use client";

import { type ConsentState, createConsent } from "@cookiechimp/core";
import { installConsentMode } from "@cookiechimp/core/consent-mode";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { blockNetwork } from "@cookiechimp/core/network";
import {
  ConsentProvider,
  useBanner,
  useCategory,
  useConsentActions,
} from "@cookiechimp/react";
import { Banner, Preferences } from "@cookiechimp/react/headless";
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
  const banner = useBanner();
  const { acceptAll, set } = useConsentActions();

  useEffect(() => {
    const gate = gateScripts(consent);
    const consentMode = installConsentMode(consent);
    const dynamic = blockDynamic(consent, { config });
    const network = blockNetwork(consent, { config });
    document.documentElement.dataset.ccDynamic = "ready";
    document.documentElement.dataset.ccConsentMode = "ready";
    document.documentElement.dataset.ccNetwork = "ready";
    return () => {
      delete document.documentElement.dataset.ccDynamic;
      delete document.documentElement.dataset.ccConsentMode;
      consentMode.stop();
      delete document.documentElement.dataset.ccNetwork;
      gate.stop();
      dynamic.stop();
      network.stop();
    };
  }, [consent]);

  return (
    <section aria-label="Consent demo">
      <Banner.Root data-testid="consent-banner">
        <Banner.Title>Cookie consent</Banner.Title>
        <Banner.Description>
          Choose how this site may use cookies.
        </Banner.Description>
        <Banner.Customize>Customize</Banner.Customize>
        <Banner.RejectAll>Reject all</Banner.RejectAll>
        <Banner.AcceptAll>Accept all cookies</Banner.AcceptAll>
      </Banner.Root>
      <Preferences.Root>
        <Preferences.Title>Cookie preferences</Preferences.Title>
        <Preferences.Description>
          Choose the categories you allow.
        </Preferences.Description>
        <Preferences.Category id="necessary">Necessary</Preferences.Category>
        <Preferences.Category id="analytics">Analytics</Preferences.Category>
        <Preferences.Save>Save preferences</Preferences.Save>
        <Preferences.AcceptAll>Accept all</Preferences.AcceptAll>
        <Preferences.RejectAll>Reject all</Preferences.RejectAll>
        <Preferences.Close>Close</Preferences.Close>
      </Preferences.Root>
      <p data-testid="consent-status">
        {accepted ? "Analytics accepted" : "Analytics declined"}
      </p>
      {!banner.open && (
        <button type="button" onClick={acceptAll}>
          Accept all cookies
        </button>
      )}
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
