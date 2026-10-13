"use client";

import { createEndpointLog, logConsent } from "@cookiechimp/core/endpoint";
import { useHeadlessContext } from "@cookiechimp/react";
import { useEffect, useState } from "react";

export function EndpointLogDemo({
  endpoint = "/api/consent",
}: {
  endpoint?: string;
}) {
  const consent = useHeadlessContext()?.consent;
  const [pending, setPending] = useState<number>();
  useEffect(() => {
    if (!consent) return;
    const log = createEndpointLog({
      endpoint,
      baseDelayMs: 500,
      maxDelayMs: 1000,
    });
    const stop = logConsent(consent, log);
    const update = () => setPending(log.pending());
    update();
    // Subscribed after logConsent, so the count already includes the decision.
    const unsubscribe = consent.subscribe(update);
    const timer = setInterval(update, 200);
    return () => {
      stop();
      unsubscribe();
      clearInterval(timer);
      log.destroy();
    };
  }, [consent, endpoint]);
  return (
    <p data-testid="endpoint-log">
      {pending === undefined ? "Endpoint log idle" : `Queued: ${pending}`}
    </p>
  );
}
