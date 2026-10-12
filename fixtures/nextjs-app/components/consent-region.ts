"use client";

import {
  type ConsentState,
  createConsent,
  type Region,
  type Regulation,
} from "@cookiechimp/core";
import { createElement, useState } from "react";

export function ConsentRegion({
  region = null,
  regulation,
  gpc = false,
  initial = null,
}: {
  region?: Region | null;
  regulation?: Regulation;
  gpc?: boolean;
  initial?: ConsentState | null;
}) {
  const [runtime] = useState(() =>
    createConsent({
      categories: ["analytics", "advertising"],
      region,
      regulation,
      gpc,
      initial,
    }),
  );
  const [state, setState] = useState(runtime.get());
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
      { type: "button", onClick: () => setState(runtime.acceptAll()) },
      "Accept regional cookies",
    ),
  );
}
