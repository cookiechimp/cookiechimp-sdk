import type { ConsentState } from "@cookiechimp/core";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { CookieChimp, store } from "./api";
import type { CookieChimpSnapshot, Selection } from "./engine";

/** The full SDK state: status, consent, dashboard config and UI visibility. */
export function useCookieChimp(): CookieChimpSnapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

/** The current consent state, or null before the SDK is ready. */
export function useConsent(): ConsentState | null {
  return useCookieChimp().consent;
}

export interface ConsentActions {
  acceptAll(): void;
  rejectAll(): void;
  /** Save a selection of categories and services. */
  save(selection: Selection): void;
  reset(): void;
}

export function useConsentActions(): ConsentActions {
  return useMemo(
    () => ({
      acceptAll: () => store.engine()?.acceptAll(),
      rejectAll: () => store.engine()?.rejectAll(),
      save: (selection: Selection) => store.engine()?.save(selection),
      reset: () => CookieChimp.reset(),
    }),
    [],
  );
}

/** True when a category is allowed. False until the SDK is ready. */
export function useCategory(id: string): boolean {
  return useConsent()?.categories[id] === true;
}

export interface CategoryState {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  enabled: boolean;
}

export function useCategories(): readonly CategoryState[] {
  const { consent, dashboard } = useCookieChimp();
  return useMemo(
    () =>
      (dashboard?.preferences ?? []).map((category) => ({
        id: category.slug,
        label: category.name,
        description: category.description,
        required: category.required,
        enabled:
          category.required || consent?.categories[category.slug] === true,
      })),
    [consent, dashboard],
  );
}

/** Call `listener` after every new decision. */
export function useOnConsentChange(listener: (state: ConsentState) => void) {
  const latest = useRef(listener);
  latest.current = listener;
  const consent = useConsent();
  const previous = useRef(consent);
  useEffect(() => {
    if (consent && previous.current && consent !== previous.current)
      latest.current(consent);
    previous.current = consent;
  }, [consent]);
}

export function useRegion() {
  const { region, regulation } = useCookieChimp();
  return { region, regulation };
}

export function useBanner() {
  const open = useCookieChimp().bannerOpen;
  return { open, show: CookieChimp.show, hide: CookieChimp.hide };
}

export function usePreferences() {
  const open = useCookieChimp().preferencesOpen;
  return {
    open,
    show: CookieChimp.showPreferences,
    hide: CookieChimp.hidePreferences,
  };
}
