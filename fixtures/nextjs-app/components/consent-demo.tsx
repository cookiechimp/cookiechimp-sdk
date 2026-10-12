"use client";

import { installConsentMode } from "@cookiechimp/core/consent-mode";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { blockNetwork } from "@cookiechimp/core/network";
import {
  useCategory,
  useConsentActions,
  useHeadlessContext,
} from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  GatedFrame,
  GatedScript,
  RecallButton,
} from "@cookiechimp/react/ui";
import { useEffect } from "react";
import { consentConfig } from "../consent-config";

export function ConsentDemo() {
  const consent = useHeadlessContext()?.consent;
  const accepted = useCategory("analytics");
  const { set } = useConsentActions();

  useEffect(() => {
    document.documentElement.dataset.ccHydrated = "true";
    return () => {
      delete document.documentElement.dataset.ccHydrated;
    };
  }, []);

  useEffect(() => {
    if (!consent) return;
    const gate = gateScripts(consent);
    const consentMode = installConsentMode(consent, consentConfig.consentMode);
    const dynamic = blockDynamic(consent, { config: consentConfig });
    const network = blockNetwork(consent, { config: consentConfig });
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

  if (!consent) return null;

  return (
    <section aria-label="Consent demo">
      <CookieBanner />
      <CookiePreferences
        categories={[
          {
            id: "necessary",
            label: "Necessary",
            description: "Required for the site to work.",
          },
          {
            id: "analytics",
            label: "Analytics",
            description: "Helps us improve this site.",
          },
        ]}
      />
      <RecallButton />
      <p data-testid="consent-status">
        {accepted ? "Analytics accepted" : "Analytics declined"}
      </p>
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
        <GatedScript category="analytics">
          {"window.__ccAnalyticsRan = true;"}
        </GatedScript>
        <GatedFrame
          title="Gated local frame"
          src="/frame"
          category="analytics"
        />
      </div>
    </section>
  );
}
