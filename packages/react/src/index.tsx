"use client";

import {
  type ConsentConfig,
  type ConsentRecord,
  type ConsentRuntime,
  type ConsentState,
  createConsent,
} from "@cookiechimp/core";
import type { ConsentLog } from "@cookiechimp/core/endpoint";
import {
  type MessageKey,
  type Messages,
  rtlLocales,
} from "@cookiechimp/translations";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type { MessageKey, Messages } from "@cookiechimp/translations";

type ProviderValue = {
  consent: ConsentRuntime;
  serverState: ConsentState;
  translations?: Messages;
  language: string;
  getSnapshot: () => ConsentState;
  subscribe: (listener: () => void) => () => void;
  preferences: ReturnType<typeof useVisibility>;
  banner: ReturnType<typeof useVisibility>;
  preferencesTrigger: { current: HTMLElement | null };
};

const Context = createContext<ProviderValue | null>(null);
type RuntimeProviderProps = {
  consent: ConsentRuntime;
  config?: never;
};
type ConfigProviderProps = {
  config: ConsentConfig;
  consent?: never;
};
export type ConsentProviderProps = (
  | RuntimeProviderProps
  | ConfigProviderProps
) & {
  children: ReactNode;
  initialState?: ConsentState | null;
  translations?: Messages;
  language?: string;
  /**
   * POST each consent decision to your own endpoint (local mode) through
   * `@cookiechimp/core/endpoint`, loaded only when this is set. A same-origin
   * path such as `/api/consent` or an https URL, optionally with static,
   * public `headers`. Requires `config`; ignored with a `consent` runtime.
   */
  endpoint?: ConsentEndpoint;
};

export type ConsentEndpoint =
  | string
  | { url: string; headers?: Record<string, string> };

/** Supply one consent runtime to a React subtree. */
export function ConsentProvider(props: ConsentProviderProps) {
  const runtime = useRef<ConsentRuntime | null>(null);
  const log = useRef<ConsentLog | null>(null);
  const early = useRef<ConsentRecord[]>([]);
  const endpoint = props.endpoint;
  const endpointKey =
    endpoint && props.config ? JSON.stringify(endpoint) : undefined;
  if (!runtime.current) {
    if (props.consent) {
      runtime.current = props.consent;
      if (endpoint && isDev())
        console.warn(
          "CookieChimp: endpoint needs config; pass onConsent to your own runtime instead.",
        );
    } else {
      const config = props.config;
      runtime.current = createConsent({
        ...config,
        initial: props.initialState ?? config.initial,
        onConsent: endpointKey
          ? (record) => {
              config.onConsent?.(record);
              if (log.current)
                log.current.record(record, runtime.current?.language);
              else early.current.push(record);
            }
          : config.onConsent,
      });
    }
  }
  useEffect(() => {
    if (!endpointKey) return;
    const target = JSON.parse(endpointKey) as ConsentEndpoint;
    let live = true;
    let made: ConsentLog | undefined;
    import("@cookiechimp/core/endpoint").then(
      ({ createEndpointLog }) => {
        if (!live) return;
        try {
          made = createEndpointLog(
            typeof target === "string"
              ? { endpoint: target }
              : { endpoint: target.url, headers: target.headers },
          );
        } catch (error) {
          // Invalid endpoint or headers: fail closed, loudly in development.
          console.error(error);
          return;
        }
        log.current = made;
        for (const record of early.current.splice(0))
          made.record(record, runtime.current?.language);
      },
      () => {},
    );
    return () => {
      live = false;
      made?.destroy();
      if (log.current === made) log.current = null;
    };
  }, [endpointKey]);
  const serverState = useRef(
    props.initialState ?? runtime.current.get(),
  ).current;
  const preferencesTrigger = useRef<HTMLElement | null>(null);
  const capturePreferencesTrigger = useCallback(() => {
    preferencesTrigger.current = document.activeElement as HTMLElement | null;
  }, []);
  const preferences = useVisibility(false, capturePreferencesTrigger);
  const banner = useVisibility(runtime.current.needsDecision);
  const value = useMemo(() => {
    const consent = runtime.current as ConsentRuntime;
    return {
      consent,
      serverState,
      translations: props.translations,
      language: props.language ?? consent.language,
      getSnapshot: () => consent.get(),
      subscribe: (listener: () => void) => consent.subscribe(listener),
      preferences,
      banner,
      preferencesTrigger,
    };
  }, [serverState, props.translations, props.language, preferences, banner]);
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

const production = () =>
  typeof process !== "undefined" && process.env.NODE_ENV === "production";
const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const message = "CookieChimp hooks must be used within a <ConsentProvider>.";
const inertState: ConsentState = Object.freeze({
  schemaVersion: 1,
  consentId: "",
  ts: "",
  categories: Object.freeze({ necessary: true }),
  action: "custom",
});
const inertPreferences = Object.freeze({
  open: false,
  show() {},
  hide() {},
});

function useConsentContext(): ProviderValue | null {
  const value = useContext(Context);
  if (!value) {
    if (!production()) throw new Error(message);
    console.warn(message);
  }
  return value;
}

/** Read the immutable current consent snapshot. */
export function useConsent(): ConsentState {
  const value = useConsentContext();
  return useSyncExternalStore(
    value?.subscribe ?? (() => () => {}),
    value?.getSnapshot ?? (() => inertState),
    () => value?.serverState ?? inertState,
  );
}

export interface ConsentActions {
  acceptAll: ConsentRuntime["acceptAll"];
  rejectAll: ConsentRuntime["rejectAll"];
  set: ConsentRuntime["set"];
}

/** Return action functions whose references stay stable across renders. */
export function useConsentActions(): ConsentActions {
  const runtime = useConsentContext()?.consent;
  return useMemo(
    () => ({
      acceptAll: runtime ? runtime.acceptAll : () => useConsentFallback,
      rejectAll: runtime ? runtime.rejectAll : () => useConsentFallback,
      set: runtime ? runtime.set : () => useConsentFallback,
    }),
    [runtime],
  );
}

const useConsentFallback = inertState;

export function useCategory(id: string): boolean {
  return useConsent().categories[id] === true;
}

export interface CategoryState {
  id: string;
  enabled: boolean;
}

export function useCategories(): readonly CategoryState[] {
  const state = useConsent();
  return useMemo(
    () =>
      Object.entries(state.categories).map(([id, enabled]) => ({
        id,
        enabled,
      })),
    [state.categories],
  );
}

/** Run the latest callback after each runtime consent decision. */
export function useOnConsentChange(fn: (state: ConsentState) => void): void {
  const runtime = useConsentContext()?.consent;
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(
    () => runtime?.subscribe((state) => latest.current(state)),
    [runtime],
  );
}

export function useRegion() {
  const runtime = useConsentContext()?.consent;
  return useMemo(
    () => ({
      region: runtime?.region ?? null,
      regulation: runtime?.regulation ?? "none",
    }),
    [runtime],
  );
}

export function useTranslations(fallback?: Messages) {
  const context = useConsentContext();
  const translations = context?.translations ?? fallback;
  const language = context?.language ?? "en";
  const t = useCallback(
    (key: MessageKey) => (translations?.[key] || fallback?.[key]) ?? key,
    [translations, fallback],
  );
  return useMemo(
    () => ({
      t,
      language,
      dir: rtlLocales.some(
        (locale) => locale === language.toLowerCase().split("-")[0],
      )
        ? ("rtl" as const)
        : ("ltr" as const),
    }),
    [t, language],
  );
}

function useVisibility(initial: boolean, onShow?: () => void) {
  const [open, setOpen] = useState(initial);
  const show = useCallback(() => {
    onShow?.();
    setOpen(true);
  }, [onShow]);
  const hide = useCallback(() => setOpen(false), []);
  return useMemo(() => ({ open, show, hide }), [open, show, hide]);
}

export function useBanner() {
  const value = useConsentContext();
  useConsent();
  const visibility = value?.banner ?? inertPreferences;
  return {
    ...visibility,
    open: visibility.open && (value?.consent.needsDecision ?? false),
  };
}

export function usePreferences() {
  return useConsentContext()?.preferences ?? inertPreferences;
}

/** Internal shared UI state used by the headless entry. */
export function useHeadlessContext() {
  return useConsentContext();
}
