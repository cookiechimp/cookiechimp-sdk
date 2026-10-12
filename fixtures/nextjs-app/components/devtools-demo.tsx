"use client";

import { gateScripts } from "@cookiechimp/core/gate";
import { mountDevtools } from "@cookiechimp/devtools";
import { readSimulation } from "@cookiechimp/devtools/simulation";
import { useConsentActions, useHeadlessContext } from "@cookiechimp/react";
import { useEffect, useState } from "react";

export function DevtoolsDemo({
  allowProduction,
}: {
  allowProduction: boolean;
}) {
  const consent = useHeadlessContext()?.consent;
  const { acceptAll } = useConsentActions();
  const [simulated, setSimulated] = useState("off");

  useEffect(() => {
    if (!consent) return;
    const simulation = readSimulation({ allowProduction });
    setSimulated(simulation ? JSON.stringify(simulation) : "off");
    const script = document.createElement("script");
    script.type = "text/plain";
    script.setAttribute(
      "data-cc-src",
      "https://devtools.cookiechimp.test/gated.js",
    );
    script.setAttribute("data-cc-category", "analytics");
    document.head.append(script);
    const gate = gateScripts(consent);
    const tools = mountDevtools({
      consent,
      blockers: [gate],
      refreshMs: 250,
      allowProduction,
    });
    document.documentElement.dataset.ccDevtools = "ready";
    return () => {
      delete document.documentElement.dataset.ccDevtools;
      tools.unmount();
      gate.stop();
      script.remove();
    };
  }, [allowProduction, consent]);

  return (
    <section aria-label="Devtools controls">
      <p data-testid="simulation">{simulated}</p>
      <button type="button" onClick={acceptAll}>
        Accept all for devtools
      </button>
    </section>
  );
}
