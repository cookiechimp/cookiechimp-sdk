"use client";

import { ConsentProvider, useConsentActions } from "@cookiechimp/react";

function Accept() {
  const actions = useConsentActions();
  return (
    <button type="button" onClick={() => actions.acceptAll()}>
      Accept all cookies
    </button>
  );
}

export function EndpointPropDemo({ url }: { url: string }) {
  return (
    <ConsentProvider
      config={{ categories: { analytics: false }, regulation: "gdpr" }}
      endpoint={{ url, headers: { "X-Site": "fixture" } }}
    >
      <Accept />
    </ConsentProvider>
  );
}
