"use client";

import { createSync, type SyncState } from "@cookiechimp/core/sync";
import { useEffect, useState } from "react";

const defaults = {
  categories: [{ id: "analytics", label: "Local analytics" }],
};

export function SyncDemo({
  apiBase = "https://api.cookiechimp.test",
  publishableKey,
  region,
  locale,
}: {
  apiBase?: string;
  publishableKey?: string;
  region?: string;
  locale?: string;
}) {
  const [state, setState] = useState<SyncState>();
  useEffect(() => {
    const sync = createSync({
      projectId: "acctREDACTED",
      publishableKey,
      apiBase,
      region,
      locale,
      defaults,
      timeoutMs: 1500,
    });
    setState(sync.get());
    const stop = sync.subscribe(setState);
    return () => {
      stop();
      sync.destroy();
    };
  }, [apiBase, publishableKey, region, locale]);
  if (!state) return null;
  const title = (
    state.dashboard?.copy.consent_modal as { title?: string } | undefined
  )?.title;
  return (
    <section
      data-cc-sync={state.status}
      data-cc-sync-source={state.source}
      data-cc-sync-banner={state.dashboard?.bannerId ?? ""}
    >
      <h2>{title ?? "Local copy"}</h2>
      <ul>
        {state.config.categories
          .filter((category) => !category.required)
          .map((category) => (
            <li key={category.id}>{category.label ?? category.id}</li>
          ))}
      </ul>
      <p data-testid="sync-error">{state.error ?? ""}</p>
    </section>
  );
}
