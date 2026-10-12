"use client";

import { useConsent, useHeadlessContext } from "@cookiechimp/react";
import { createElement } from "react";

export function ConsentRegion() {
  const runtime = useHeadlessContext()?.consent;
  const state = useConsent();
  if (!runtime) return null;
  const line = (testId: string, text: string) =>
    createElement("p", { "data-testid": testId }, text);
  return createElement(
    "section",
    { "aria-label": "Regional consent", "data-testid": "consent-region" },
    line("regulation", runtime.regulation),
    line(
      "decision",
      runtime.needsDecision ? "decision needed" : "no decision needed",
    ),
    line(
      "regional-analytics",
      `analytics ${state.categories.analytics ? "on" : "off"}`,
    ),
    line(
      "regional-advertising",
      `advertising ${state.categories.advertising ? "on" : "off"}`,
    ),
    line("regional-action", state.action),
    createElement(
      "button",
      { type: "button", onClick: runtime.acceptAll },
      "Accept regional cookies",
    ),
  );
}
