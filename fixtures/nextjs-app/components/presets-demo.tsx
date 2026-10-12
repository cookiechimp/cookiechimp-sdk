"use client";

import { useConsentActions, useHeadlessContext } from "@cookiechimp/react";
import {
  applyPresets,
  type QueueTarget,
  type ScriptPreset,
} from "@cookiechimp/scripts";
import { ga4 } from "@cookiechimp/scripts/ga4";
import { googleAds } from "@cookiechimp/scripts/google-ads";
import { gtm } from "@cookiechimp/scripts/gtm";
import { useEffect } from "react";

const addScript = (preset: ScriptPreset) => {
  const script = document.createElement("script");
  for (const [name, value] of Object.entries(preset.script.attributes))
    script.setAttribute(name, value);
  document.head.append(script);
};

export function PresetsDemo({ advanced }: { advanced: boolean }) {
  const consent = useHeadlessContext()?.consent;
  const { acceptAll, set } = useConsentActions();

  useEffect(() => {
    if (!consent) return;
    const presets = [
      ga4({ measurementId: "G-COOKIECHIMP" }),
      gtm({
        containerId: "GTM-COOKIECHIMP",
        category: "analytics",
        consentMode: advanced ? "advanced" : "basic",
      }),
      googleAds({ conversionId: "AW-COOKIECHIMP" }),
    ];
    // Exercise config composition in the browser as well as exporting the
    // composed fixture config used by the provider.
    applyPresets({ categories: ["analytics", "marketing"] }, presets);
    for (const preset of presets)
      preset.queue.install(window as unknown as QueueTarget);
    (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag?.(
      "event",
      "preset_early_call",
    );
    for (const preset of presets) addScript(preset);
    document.documentElement.dataset.ccPresets = "ready";
    return () => {
      delete document.documentElement.dataset.ccPresets;
      for (const preset of presets)
        document.querySelector(`[data-cc-service="${preset.id}"]`)?.remove();
    };
  }, [advanced, consent]);

  return (
    <section aria-label="Preset controls">
      <p>{advanced ? "GTM advanced" : "GTM basic"}</p>
      <button
        type="button"
        onClick={() =>
          set({ categories: { analytics: true, marketing: false } })
        }
      >
        Accept analytics only
      </button>
      <button type="button" onClick={acceptAll}>
        Accept all presets
      </button>
    </section>
  );
}
