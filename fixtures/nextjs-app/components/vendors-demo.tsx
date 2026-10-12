"use client";

import { gateScripts } from "@cookiechimp/core/gate";
import { useConsentActions, useHeadlessContext } from "@cookiechimp/react";
import { useEffect } from "react";
import { vendorPresets } from "../consent-config";

export function VendorsDemo() {
  const consent = useHeadlessContext()?.consent;
  const { acceptAll, set } = useConsentActions();

  useEffect(() => {
    if (!consent) return;
    const presets = vendorPresets();
    const scripts = presets.map((preset) => {
      preset.queue.install(window as never)("track", "fixture_early_call");
      const script = document.createElement("script");
      for (const [name, value] of Object.entries(preset.script.attributes))
        script.setAttribute(name, value);
      document.head.append(script);
      return script;
    });
    const gate = gateScripts(consent);
    document.documentElement.dataset.ccVendors = "ready";
    return () => {
      delete document.documentElement.dataset.ccVendors;
      gate.stop();
      for (const script of scripts) script.remove();
    };
  }, [consent]);

  return (
    <section aria-label="Vendor controls">
      <button
        type="button"
        onClick={() =>
          set({ categories: { analytics: true, marketing: false } })
        }
      >
        Accept analytics only
      </button>
      <button type="button" onClick={acceptAll}>
        Accept all vendors
      </button>
    </section>
  );
}
