"use client";

import { createSync, type SyncState } from "@cookiechimp/core/sync";
import { useEffect, useState } from "react";

const defaults = {
  categories: [{ id: "analytics", label: "Local analytics" }],
};

export function SyncDemo({
  apiBase = "https://api.cookiechimp.test/sdk/v1",
  publishableKey = "cc_pk_fixture1234",
}: {
  apiBase?: string;
  publishableKey?: string;
}) {
  const [state, setState] = useState<SyncState>();
  useEffect(() => {
    const sync = createSync({
      projectId: "proj_fixture",
      publishableKey,
      apiBase,
      defaults,
      timeoutMs: 1500,
    });
    setState(sync.get());
    const stop = sync.subscribe(setState);
    return () => {
      stop();
      sync.destroy();
    };
  }, [apiBase, publishableKey]);
  if (!state) return null;
  return (
    <section
      data-cc-sync={state.status}
      data-cc-sync-source={state.source}
      data-cc-sync-changed={String(state.categoriesChanged)}
    >
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
