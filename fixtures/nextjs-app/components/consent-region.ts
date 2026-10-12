"use client";

import { createElement } from "react";

export function ConsentRegion() {
  return createElement(
    "section",
    { "aria-label": "Consent placeholder", "data-testid": "consent-region" },
    "Consent controls will appear here.",
  );
}
