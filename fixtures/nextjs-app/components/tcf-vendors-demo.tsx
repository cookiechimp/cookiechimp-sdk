"use client";

import { type ConsentRuntime, createConsent } from "@cookiechimp/core";
import type { TcfController } from "@cookiechimp/core/tcf";
import { ConsentProvider, usePreferences } from "@cookiechimp/react";
import { TcfVendorList } from "@cookiechimp/react/tcf";
import { CookiePreferences } from "@cookiechimp/react/ui";
import { useEffect, useState } from "react";

function Manage() {
  const preferences = usePreferences();
  return (
    <button type="button" onClick={preferences.show}>
      Manage vendors
    </button>
  );
}

export function TcfVendorsDemo() {
  const [consent, setConsent] = useState<ConsentRuntime | null>(null);
  const [controller, setController] = useState<TcfController | null>(null);
  useEffect(() => {
    const runtime = createConsent({
      categories: { marketing: false },
      cookie: { name: "cc_tcf_vendors_fixture" },
      regulation: "gdpr",
    });
    setConsent(runtime);
    let stop = () => {};
    import("@cookiechimp/core/tcf").then(async ({ installTcf }) => {
      // 300 is a fixture-only placeholder, not an IAB assigned CMP ID.
      const tcf = installTcf(runtime, {
        cmpId: 300,
        publisherCC: "IE",
        gvl: () => fetch("/tcf/gvl?large").then((r) => r.json()),
      });
      stop = tcf.stop;
      await tcf.ready;
      setController(tcf);
      document.documentElement.dataset.ccTcf = "ready";
    });
    return () => {
      stop();
      delete document.documentElement.dataset.ccTcf;
    };
  }, []);
  if (!consent) return null;
  return (
    <ConsentProvider consent={consent}>
      <Manage />
      <CookiePreferences categories={[{ id: "marketing", label: "Marketing" }]}>
        {controller && (
          <TcfVendorList controller={controller} height={240} rowHeight={40} />
        )}
      </CookiePreferences>
    </ConsentProvider>
  );
}
