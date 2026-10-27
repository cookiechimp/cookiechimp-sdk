import type { ConsentState } from "@cookiechimp/core";
import type { DashboardConfig } from "@cookiechimp/core/sync";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CookieChimp, store } from "./api";
import { type AppData, appData } from "./app-data";
import type { CookieChimpSnapshot, Selection } from "./engine";
import { type DebugEvent, debugEvents } from "./events";
import { url } from "./presentation";
import type { ConsentText } from "./text";

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

/** A vendor (service) inside a category, as the dashboard describes it. */
export interface ServiceState {
  /** The SDK id, used in `consent.services` and `save({ services })`. */
  id: string;
  name: string;
  /** Dashboard rich text (HTML). Render it with `richText`. */
  description?: string;
  company?: string;
  privacyPolicyUrl?: string;
  /** Store-style data labels for a mobile SDK, when the dashboard has them. */
  appData?: AppData;
  enabled: boolean;
}

export interface CategoryState {
  id: string;
  label: string;
  /** Dashboard rich text (HTML). Render it with `richText`. */
  description?: string;
  required: boolean;
  enabled: boolean;
  services: readonly ServiceState[];
}

function categoriesOf(
  dashboard: DashboardConfig | null,
  categories: Readonly<Record<string, boolean>>,
  services: Readonly<Record<string, boolean>>,
): CategoryState[] {
  return (dashboard?.preferences ?? []).map((category) => ({
    id: category.slug,
    label: category.name,
    description: category.description,
    required: category.required,
    enabled: category.required || categories[category.slug] === true,
    services: category.services.map((service) => ({
      id: service.consent_key,
      name: service.name,
      description: service.description,
      company: service.company,
      privacyPolicyUrl: url(service.privacy_policy_url),
      appData: appData(service.app_data),
      enabled: category.required || services[service.consent_key] === true,
    })),
  }));
}

/** Categories with their services, labels and current decisions. */
export function useCategories(): readonly CategoryState[] {
  const { consent, dashboard } = useCookieChimp();
  return useMemo(
    () =>
      categoriesOf(
        dashboard,
        consent?.categories ?? {},
        consent?.services ?? {},
      ),
    [consent, dashboard],
  );
}

/**
 * The banner and preferences copy from the dashboard, with the SDK's
 * translated fallbacks for anything missing. Null until the config loads.
 */
export function useConsentText(): ConsentText | null {
  return useCookieChimp().text;
}

export interface ConsentDraft {
  /** Categories with each one's pending (unsaved) state. */
  categories: readonly CategoryState[];
  /** Switch a category and all of its services. */
  toggleCategory(id: string, enabled?: boolean): void;
  /** Switch one service; its category is on while any of its services is. */
  toggleService(id: string, enabled?: boolean): void;
  /** Save the pending choices as the user's decision. */
  save(): void;
  /** Start again from the saved decision. */
  discard(): void;
}

/**
 * Pending choices for a custom preferences screen. Changes stay local until
 * `save()`; required categories cannot be switched off.
 */
export function useConsentDraft(): ConsentDraft {
  const { consent, dashboard } = useCookieChimp();
  const fromConsent = useCallback(
    () => ({
      categories: { ...consent?.categories },
      services: { ...consent?.services },
    }),
    [consent],
  );
  const [draft, setDraft] = useState(fromConsent);
  useEffect(() => setDraft(fromConsent()), [fromConsent]);
  const toggleCategory = useCallback(
    (id: string, enabled?: boolean) =>
      setDraft((previous) => {
        const category = dashboard?.preferences?.find(
          (item) => item.slug === id,
        );
        if (!category || category.required) return previous;
        const next = enabled ?? !previous.categories[id];
        return {
          categories: { ...previous.categories, [id]: next },
          services: {
            ...previous.services,
            ...Object.fromEntries(
              category.services.map((service) => [service.consent_key, next]),
            ),
          },
        };
      }),
    [dashboard],
  );
  const toggleService = useCallback(
    (id: string, enabled?: boolean) =>
      setDraft((previous) => {
        const category = dashboard?.preferences?.find((item) =>
          item.services.some((service) => service.consent_key === id),
        );
        if (!category || category.required) return previous;
        const services = {
          ...previous.services,
          [id]: enabled ?? !previous.services[id],
        };
        return {
          services,
          categories: {
            ...previous.categories,
            [category.slug]: category.services.some(
              (service) => services[service.consent_key],
            ),
          },
        };
      }),
    [dashboard],
  );
  const categories = useMemo(
    () => categoriesOf(dashboard, draft.categories, draft.services),
    [dashboard, draft],
  );
  const save = useCallback(() => store.engine()?.save(draft), [draft]);
  const discard = useCallback(() => setDraft(fromConsent()), [fromConsent]);
  return { categories, toggleCategory, toggleService, save, discard };
}

/** The SDK's recent activity, newest first, as shown in the debug panel. */
export function useDebugEvents(): readonly DebugEvent[] {
  return useSyncExternalStore(
    debugEvents.subscribe,
    debugEvents.get,
    debugEvents.get,
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
