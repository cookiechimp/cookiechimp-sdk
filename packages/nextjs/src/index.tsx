"use client";

import type { ConsentConfig, ConsentState } from "@cookiechimp/core";
import {
  type ConsentEndpoint,
  ConsentProvider,
  type ConsentProviderProps,
  type Messages,
} from "@cookiechimp/react";
import type { ReactNode } from "react";

export type ClientProviderProps = {
  config: ConsentConfig;
  children: ReactNode;
  initialState?: ConsentState | null;
  language?: string;
  messages?: Messages;
  /** Self-hosted consent log endpoint; see `ConsentProvider`. */
  endpoint?: ConsentEndpoint;
};

/** Client boundary used by the App Router server provider. */
export function ClientProvider({
  config,
  children,
  initialState,
  language,
  messages,
  endpoint,
}: ClientProviderProps) {
  return (
    <ConsentProvider
      config={config}
      initialState={initialState}
      language={language}
      translations={messages}
      endpoint={endpoint}
    >
      {children}
    </ConsentProvider>
  );
}

export { ConsentProvider } from "@cookiechimp/react";
export type { ConsentEndpoint, ConsentProviderProps, Messages };
