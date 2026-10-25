import {
  type ConsentRuntime,
  type ConsentState,
  createConsent,
  decodeConsentCookie,
  type Region,
  type Regulation,
} from "@cookiechimp/core";
import {
  type ConsentLog,
  createConsentLog,
  logConsent,
} from "@cookiechimp/core/consent-log";
import {
  adaptPlatformConfig,
  createSync,
  type DashboardConfig,
  type SyncClient,
} from "@cookiechimp/core/sync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type NativeEventSubscription, Platform } from "react-native";
import { fetchRegion, parseRegion, regionKey } from "./region";
import {
  type AsyncKeyValueStorage,
  type MirroredStorage,
  mirrorStorage,
} from "./storage";
import { applyVendors } from "./vendors";

export const DEFAULT_API = "https://cookiechimp.com";
const REVALIDATE_AFTER = 5 * 60 * 1000;
const COOKIE_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;

/** The consent summary passed to callbacks and returned by `getUserPreferences`. */
export interface UserPreferences {
  acceptType: "all" | "necessary" | "custom";
  acceptedCategories: string[];
  rejectedCategories: string[];
  /** Category id to accepted service ids. */
  acceptedServices: Record<string, string[]>;
  /** Category id to rejected service ids. */
  rejectedServices: Record<string, string[]>;
  consentId: string;
  /** ISO 8601 time of the decision. */
  consentTimestamp: string;
}

export interface CookieChimpOptions {
  /** Your CookieChimp account ID. Config is fetched, cached and kept up to date. */
  accountId?: string;
  /**
   * Offline mode: the config JSON downloaded from the dashboard. No config
   * requests are made. Consent records still sync when `accountId` or the
   * bundle's account is known.
   */
  config?: unknown;
  /** Country or US state that selects the banner, for example `DE` or `US-CA`. */
  country?: string;
  /** Banner language, for example `de` or `pt-BR`. Defaults to the device language. */
  language?: string;
  /**
   * Ask CookieChimp's first-party endpoint for the connection's country when
   * `country` is not given. Defaults to true.
   */
  geolocation?: boolean;
  /** Send consent records to CookieChimp. Defaults to true. */
  syncConsents?: boolean;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  /** Storage for consent, the config cache and queued records. Defaults to AsyncStorage. */
  storage?: AsyncKeyValueStorage;
  /** Log SDK activity to the console. */
  debug?: boolean;
  /** After every decision, and on launch when a valid decision is stored. */
  onAccept?: (preferences: UserPreferences) => void;
  /** After the first decision on this install. */
  onFirstConsent?: (preferences: UserPreferences) => void;
  /** After a later decision that changed categories or services. */
  onChange?: (
    preferences: UserPreferences,
    changedCategories: string[],
    changedServices: string[],
  ) => void;
  /** Replace the network transport, for tests. */
  fetch?: typeof fetch;
}

export interface CookieChimpSnapshot {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  consent: ConsentState | null;
  /** True once the user has made a choice that is still valid. */
  decided: boolean;
  dashboard: DashboardConfig | null;
  region: Region | null;
  regulation: Regulation | null;
  language: string;
  bannerOpen: boolean;
  preferencesOpen: boolean;
}

export const IDLE: CookieChimpSnapshot = Object.freeze({
  status: "idle",
  consent: null,
  decided: false,
  dashboard: null,
  region: null,
  regulation: null,
  language: "en",
  bannerOpen: false,
  preferencesOpen: false,
});

export interface Selection {
  categories?: Readonly<Record<string, boolean>>;
  services?: Readonly<Record<string, boolean>>;
}

export interface Engine {
  getSnapshot(): CookieChimpSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  destroy(): void;
  runtime(): ConsentRuntime | null;
  acceptAll(): void;
  rejectAll(): void;
  save(selection: Selection): void;
  showBanner(): void;
  hideBanner(): void;
  showPreferences(): void;
  hidePreferences(): void;
  reset(): void;
  /** Send queued consent records now. Resolves with the number still queued. */
  flush(): Promise<number>;
}

/** Summarize a consent state for callbacks and `getUserPreferences`. */
export function toUserPreferences(
  state: ConsentState,
  dashboard: DashboardConfig | null,
): UserPreferences {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const [id, enabled] of Object.entries(state.categories))
    (enabled ? accepted : rejected).push(id);
  const acceptedServices: Record<string, string[]> = {};
  const rejectedServices: Record<string, string[]> = {};
  for (const service of dashboard?.services ?? []) {
    const target = state.services?.[service.id]
      ? acceptedServices
      : rejectedServices;
    if (!target[service.category]) target[service.category] = [];
    target[service.category]?.push(service.id);
  }
  return {
    acceptType:
      state.action === "accept_all"
        ? "all"
        : state.action === "reject_all"
          ? "necessary"
          : "custom",
    acceptedCategories: accepted,
    rejectedCategories: rejected,
    acceptedServices,
    rejectedServices,
    consentId: state.consentId,
    consentTimestamp: state.ts,
  };
}

/** The device language, for example `de-DE`. */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
}

const changed = (
  before: Readonly<Record<string, boolean>> | undefined,
  after: Readonly<Record<string, boolean>> | undefined,
) =>
  [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
    .filter((key) => (before?.[key] === true) !== (after?.[key] === true))
    .sort();

export function createEngine(options: CookieChimpOptions): Engine {
  const apiBase = (options.apiBase ?? DEFAULT_API).replace(/\/$/, "");
  const listeners = new Set<() => void>();
  let snapshot: CookieChimpSnapshot = IDLE;
  let store: MirroredStorage | undefined;
  let sync: SyncClient | undefined;
  let runtime: ConsentRuntime | null = null;
  let log: ConsentLog | undefined;
  let stopRuntime: (() => void) | undefined;
  let appState: NativeEventSubscription | undefined;
  let lastRevalidate = 0;
  let destroyed = false;
  let cookieName = "cc_consent";

  const debug = (...args: unknown[]) => {
    if (options.debug) console.log("[CookieChimp]", ...args);
  };
  const update = (patch: Partial<CookieChimpSnapshot>) => {
    if (destroyed) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const fail = (error: string) => {
    debug("error:", error);
    update({ status: "error", error });
  };

  const apply = (dashboard: DashboardConfig, region: Region | null) => {
    if (!store || destroyed) return;
    stopRuntime?.();
    log?.destroy();
    const days = Number(
      dashboard.banner.expires_days ??
        dashboard.banner.consent_duration_days ??
        dashboard.cookie.expires_days,
    );
    cookieName =
      typeof dashboard.cookie.name === "string" &&
      COOKIE_NAME.test(dashboard.cookie.name)
        ? dashboard.cookie.name
        : "cc_consent";
    // A dashboard re-consent date invalidates decisions made before it.
    const stored = store.getItem(cookieName);
    const previous = stored ? decodeConsentCookie(stored) : null;
    const reconsent = Date.parse(dashboard.reconsentRequiredAt ?? "");
    if (previous && Date.parse(previous.ts) < reconsent) {
      debug("re-consent required since", dashboard.reconsentRequiredAt);
      store.removeItem(cookieName);
    }
    try {
      runtime = createConsent({
        categories: dashboard.categories,
        services: dashboard.services,
        regulation: dashboard.consentMode === "opt_out" ? "ccpa" : "gdpr",
        language: dashboard.language,
        promptOnOptOut: true,
        region,
        gpc: false,
        storage: store,
        cookie: {
          name: cookieName,
          ...(Number.isInteger(days) && days > 0 && days <= 730
            ? { maxAge: days * 86400 }
            : {}),
        },
      });
    } catch (error) {
      runtime = null;
      applyVendors(null);
      return fail(error instanceof Error ? error.message : "invalid config");
    }
    const consent = runtime;
    const projectId = options.accountId ?? dashboard.accountId;
    log =
      options.syncConsents === false
        ? undefined
        : createConsentLog({
            projectId,
            apiBase,
            platform: Platform.OS === "ios" ? "ios" : "android",
            storage: store,
            bannerId: dashboard.bannerId,
            serviceCategories: Object.fromEntries(
              dashboard.services.map(({ id, category }) => [id, category]),
            ),
            ...(options.fetch ? { fetch: options.fetch } : {}),
          });
    const stopLog = log ? logConsent(consent, log) : undefined;
    const stopListen = consent.subscribe((state) => {
      const before = snapshot.consent;
      const first = !snapshot.decided;
      const preferences = toUserPreferences(state, dashboard);
      debug("consent", preferences);
      update({
        consent: state,
        decided: true,
        bannerOpen: false,
        preferencesOpen: false,
      });
      applyVendors(consent);
      const categories = changed(before?.categories, state.categories);
      const services = changed(before?.services, state.services);
      if (first) options.onFirstConsent?.(preferences);
      else if (categories.length || services.length)
        options.onChange?.(preferences, categories, services);
      options.onAccept?.(preferences);
    });
    stopRuntime = () => {
      stopListen();
      stopLog?.();
    };
    const decided = !consent.needsDecision;
    debug(
      `banner ${dashboard.bannerId} (${dashboard.language}), regulation ${consent.regulation}, decided ${decided}`,
    );
    update({
      status: "ready",
      error: undefined,
      consent: consent.get(),
      decided,
      dashboard,
      region,
      regulation: consent.regulation,
      language: dashboard.language,
      bannerOpen: !decided,
      preferencesOpen: false,
    });
    applyVendors(consent);
    if (decided)
      options.onAccept?.(toUserPreferences(consent.get(), dashboard));
  };

  const revalidate = (region: Region | null) => {
    if (!sync) return;
    lastRevalidate = Date.now();
    void sync.revalidate().then((state) => {
      const next = state.dashboard;
      if (next && next.configVersion !== snapshot.dashboard?.configVersion) {
        debug("config updated to", next.configVersion);
        apply(next, region);
      }
    });
  };

  const engine: Engine = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      update({ status: "loading" });
      store = await mirrorStorage(options.storage ?? AsyncStorage);
      if (destroyed) return;
      const region =
        parseRegion(options.country) ??
        (options.geolocation !== false && options.accountId && !options.config
          ? await fetchRegion({
              accountId: options.accountId,
              apiBase,
              fetch: options.fetch,
            })
          : null);
      if (destroyed) return;
      const locale = options.language ?? deviceLocale();
      debug("region", regionKey(region) || "none", "locale", locale);
      // Retry delivery on every foreground; refresh config after five minutes,
      // or right away while the first config download has not succeeded.
      appState = AppState.addEventListener("change", (next) => {
        if (next !== "active") return;
        void log?.retry();
        if (
          !snapshot.dashboard ||
          Date.now() - lastRevalidate > REVALIDATE_AFTER
        )
          revalidate(region);
      });
      let dashboard: DashboardConfig | undefined;
      if (options.config !== undefined) {
        dashboard = adaptPlatformConfig(options.config, {
          locale,
          region: regionKey(region),
          ...(options.accountId ? { projectId: options.accountId } : {}),
        });
        if (!dashboard) return fail("invalid config");
      } else if (options.accountId) {
        sync = createSync({
          projectId: options.accountId,
          apiBase,
          locale,
          region: regionKey(region),
          storage: store,
          revalidate: false,
          ...(options.fetch ? { fetch: options.fetch } : {}),
        });
        dashboard = sync.get().dashboard;
        if (dashboard) revalidate(region);
        else {
          lastRevalidate = Date.now();
          const state = await sync.revalidate();
          dashboard = state.dashboard;
          if (!dashboard) return fail(state.error ?? "config unavailable");
        }
      } else return fail("accountId or config is required");
      apply(dashboard, region);
    },
    destroy() {
      destroyed = true;
      stopRuntime?.();
      log?.destroy();
      sync?.destroy();
      appState?.remove();
      listeners.clear();
      if (runtime) applyVendors(null);
    },
    runtime: () => runtime,
    acceptAll: () => void runtime?.acceptAll(),
    rejectAll: () => void runtime?.rejectAll(),
    save(selection) {
      runtime?.set({
        categories: selection.categories ?? {},
        services: selection.services ?? {},
      });
    },
    showBanner: () => {
      if (runtime) update({ bannerOpen: true, preferencesOpen: false });
    },
    hideBanner: () => update({ bannerOpen: false }),
    showPreferences: () => {
      if (runtime) update({ preferencesOpen: true });
    },
    hidePreferences: () => update({ preferencesOpen: false }),
    reset() {
      const dashboard = snapshot.dashboard;
      if (!store || !dashboard) return;
      store.removeItem(cookieName);
      apply(dashboard, snapshot.region);
    },
    flush: () => log?.retry() ?? Promise.resolve(0),
  };
  return engine;
}
