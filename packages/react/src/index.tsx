"use client";

import {
  type ConsentConfig,
  type ConsentRuntime,
  type ConsentState,
  createConsent,
} from "@cookiechimp/core";
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

export type Translations = Readonly<Record<string, string>>;

type ProviderValue = {
  consent: ConsentRuntime;
  serverState: ConsentState;
  translations: Translations;
  getSnapshot: () => ConsentState;
  subscribe: (listener: () => void) => () => void;
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
  translations?: Translations;
};

/** Supply one consent runtime to a React subtree. */
export function ConsentProvider(props: ConsentProviderProps) {
  const runtime = useRef<ConsentRuntime | null>(null);
  if (!runtime.current)
    runtime.current =
      props.consent ??
      createConsent({
        ...props.config,
        initial: props.initialState ?? props.config.initial,
      });
  const serverState = useRef(
    props.initialState ?? runtime.current.get(),
  ).current;
  const snapshot = useRef(serverState);
  const value = useMemo(() => {
    const consent = runtime.current as ConsentRuntime;
    return {
      consent,
      serverState,
      translations: props.translations ?? {},
      getSnapshot: () => snapshot.current,
      subscribe: (listener: () => void) =>
        consent.subscribe((state) => {
          snapshot.current = state;
          listener();
        }),
    };
  }, [serverState, props.translations]);
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

const production = () =>
  typeof process !== "undefined" && process.env.NODE_ENV === "production";
const message = "CookieChimp hooks must be used within a <ConsentProvider>.";

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
  const fallback = useRef<ConsentState>(
    Object.freeze({
      schemaVersion: 1,
      consentId: "",
      ts: "",
      categories: Object.freeze({ necessary: true }),
      action: "custom",
    }),
  ).current;
  return useSyncExternalStore(
    value?.subscribe ?? (() => () => {}),
    value?.getSnapshot ?? (() => fallback),
    () => value?.serverState ?? fallback,
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

const useConsentFallback = Object.freeze({
  schemaVersion: 1,
  consentId: "",
  ts: "",
  categories: Object.freeze({ necessary: true }),
  action: "custom" as const,
});

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

export function useTranslations() {
  const translations = useConsentContext()?.translations ?? {};
  const t = useCallback(
    (key: string, fallback = key) => translations[key] ?? fallback,
    [translations],
  );
  return useMemo(() => ({ translations, t }), [translations, t]);
}

function useVisibility(initial: boolean) {
  const [open, setOpen] = useState(initial);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  return useMemo(() => ({ open, show, hide }), [open, show, hide]);
}

export function useBanner() {
  const runtime = useConsentContext()?.consent;
  useConsent();
  const visibility = useVisibility(runtime?.needsDecision ?? false);
  return {
    ...visibility,
    open: visibility.open && (runtime?.needsDecision ?? false),
  };
}

export function usePreferences() {
  useConsentContext();
  return useVisibility(false);
}
