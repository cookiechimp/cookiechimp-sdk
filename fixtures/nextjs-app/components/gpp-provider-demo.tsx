"use client";

import { useConsentActions } from "@cookiechimp/react";

export function GppProviderDemo() {
  const actions = useConsentActions();
  return (
    <div>
      <button type="button" onClick={() => actions.rejectAll()}>
        Opt out of sale
      </button>
      <button type="button" onClick={() => actions.acceptAll()}>
        Allow sale
      </button>
    </div>
  );
}
