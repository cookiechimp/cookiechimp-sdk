"use client";

import { createConsentLog, logConsent } from "@cookiechimp/core/consent-log";
import { useHeadlessContext } from "@cookiechimp/react";
import { useEffect, useState } from "react";

export function ConsentLogDemo({
  apiBase = "https://api.cookiechimp.test",
}: {
  apiBase?: string;
}) {
  const consent = useHeadlessContext()?.consent;
  const [pending, setPending] = useState<number>();
  useEffect(() => {
    if (!consent) return;
    const log = createConsentLog({
      projectId: "acctREDACTED",
      apiBase,
      bannerId: "bnrEU1",
      serviceCategories: {},
      baseDelayMs: 500,
      maxDelayMs: 1000,
    });
    const stop = logConsent(consent, log);
    const update = () => setPending(log.pending());
    update();
    const unsubscribe = consent.subscribe(() => {
      update();
      void log.flush().then(update);
    });
    const timer = setInterval(update, 200);
    return () => {
      stop();
      unsubscribe();
      clearInterval(timer);
      log.destroy();
    };
  }, [consent, apiBase]);
  return (
    <p data-testid="consent-log" data-pending={pending ?? ""}>
      {pending === undefined ? "Consent log idle" : `Queued: ${pending}`}
    </p>
  );
}
