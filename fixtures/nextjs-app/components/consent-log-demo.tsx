"use client";

import { createConsentLog, logConsent } from "@cookiechimp/core/consent-log";
import { useHeadlessContext } from "@cookiechimp/react";
import { useEffect, useState } from "react";

export function ConsentLogDemo({
  apiBase = "https://api.cookiechimp.test",
  baseDelayMs = 500,
}: {
  apiBase?: string;
  /** Retry delay; the page-hide test sets it high so only the hide flush can deliver. */
  baseDelayMs?: number;
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
      baseDelayMs,
      maxDelayMs: Math.max(1000, baseDelayMs),
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
  }, [consent, apiBase, baseDelayMs]);
  return (
    <p data-testid="consent-log" data-pending={pending ?? ""}>
      {pending === undefined ? "Consent log idle" : `Queued: ${pending}`}
    </p>
  );
}
