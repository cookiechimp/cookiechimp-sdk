"use client";

import type { ConsentConfig, ConsentState } from "@cookiechimp/core";
import {
  type ConsentEndpoint,
  ConsentProvider,
  type ConsentProviderProps,
  type Messages,
} from "@cookiechimp/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { dashboardMessages } from "./messages";

/**
 * Serialisable seed for revalidating the dashboard config in the browser
 * after hydration. `etag` is the version the server rendered, so an
 * unchanged config costs one 304.
 */
export type ClientSync = {
  projectId: string;
  apiBase?: string;
  locale?: string;
  region?: string;
  etag?: string;
};

export type ClientProviderProps = {
  config: ConsentConfig;
  children: ReactNode;
  initialState?: ConsentState | null;
  language?: string;
  messages?: Messages;
  /** Self-hosted consent log endpoint; see `ConsentProvider`. */
  endpoint?: ConsentEndpoint;
  /** Revalidate the dashboard config after hydration (connected mode). */
  sync?: ClientSync;
};

/** Client boundary used by the App Router server provider. */
export function ClientProvider({
  config,
  children,
  initialState,
  language,
  messages,
  endpoint,
  sync,
}: ClientProviderProps) {
  const [fresh, setFresh] = useState<Messages>();
  const syncKey = sync ? JSON.stringify(sync) : undefined;
  useEffect(() => {
    if (!syncKey) return;
    const seed = JSON.parse(syncKey) as ClientSync;
    let stop: (() => void) | undefined;
    let live = true;
    // Loaded only in connected mode, after hydration, off the critical path.
    import("@cookiechimp/core/sync").then(
      ({ createSync }) => {
        if (!live) return;
        try {
          const client = createSync({
            projectId: seed.projectId,
            apiBase: seed.apiBase,
            locale: seed.locale,
            region: seed.region,
            etag: seed.etag,
            defaults: {
              categories: config.categories,
              services: config.services,
            },
          });
          const unsubscribe = client.subscribe((state) => {
            // Only a config newer than the one the server rendered changes copy.
            if (
              state.source === "dashboard" &&
              state.dashboard &&
              state.dashboard.etag !== seed.etag
            )
              setFresh(dashboardMessages(state.dashboard));
          });
          stop = () => {
            unsubscribe();
            client.destroy();
          };
        } catch (error) {
          console.error(error);
        }
      },
      () => {},
    );
    return () => {
      live = false;
      stop?.();
    };
  }, [syncKey, config.categories, config.services]);
  const translations = useMemo(
    () => (fresh ? ({ ...messages, ...fresh } as Messages) : messages),
    [messages, fresh],
  );
  return (
    <ConsentProvider
      config={config}
      initialState={initialState}
      language={language}
      translations={translations}
      endpoint={endpoint}
    >
      {children}
    </ConsentProvider>
  );
}

export { ConsentProvider } from "@cookiechimp/react";
export { dashboardMessages } from "./messages";
export type { ConsentEndpoint, ConsentProviderProps, Messages };
