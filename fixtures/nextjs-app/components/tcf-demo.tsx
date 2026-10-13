"use client";

import { type ConsentRuntime, createConsent } from "@cookiechimp/core";
import { regulationFor } from "@cookiechimp/core/regions";
import { useEffect, useState } from "react";

export function TcfDemo({
  cmpId,
  invalidGvl,
  country,
}: {
  cmpId?: number;
  invalidGvl: boolean;
  country: string;
}) {
  const [runtime, setRuntime] = useState<ConsentRuntime | null>(null);
  useEffect(() => {
    const consent = createConsent({
      categories: { analytics: false, marketing: false },
      cookie: { name: "cc_tcf_fixture" },
      region: { country },
      resolveRegulation: regulationFor,
    });
    let stop = () => {};
    let active = true;
    import("@cookiechimp/core/tcf").then(async ({ installTcf }) => {
      if (!active) return;
      const controller = installTcf(consent, {
        cmpId,
        publisherCC: "IE",
        gvl: () =>
          fetch(`/tcf/gvl${invalidGvl ? "?invalid" : ""}`).then((r) =>
            r.json(),
          ),
      });
      stop = controller.stop;
      await controller.ready;
      document.documentElement.dataset.ccTcf = controller.enabled
        ? "ready"
        : "disabled";
    });
    setRuntime(consent);
    return () => {
      active = false;
      stop();
      delete document.documentElement.dataset.ccTcf;
    };
  }, [cmpId, invalidGvl, country]);
  return (
    <div>
      <button type="button" onClick={() => runtime?.acceptAll()}>
        Accept TCF purposes
      </button>
      <button type="button" onClick={() => runtime?.rejectAll()}>
        Reject TCF purposes
      </button>
    </div>
  );
}
