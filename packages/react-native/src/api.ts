import {
  type CookieChimpOptions,
  type CookieChimpSnapshot,
  createEngine,
  type Engine,
  IDLE,
  toUserPreferences,
  type UserPreferences,
} from "./engine";
import {
  getVendors,
  isVendorRunning,
  registerVendor,
  serviceId,
  startVendor,
  stopVendor,
  unregisterVendor,
} from "./vendors";

type ChangeListener = (
  preferences: UserPreferences,
  changedCategories: string[],
  changedServices: string[],
) => void;

let engine: Engine | null = null;
let detach: (() => void) | undefined;
const listeners = new Set<() => void>();
const changeListeners = new Set<ChangeListener>();
const notify = () => {
  for (const listener of listeners) listener();
};

/** Subscribe to the active engine's snapshot. Used by the React bindings. */
export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): CookieChimpSnapshot => engine?.getSnapshot() ?? IDLE,
  engine: () => engine,
};

function categoryIds(): string[] {
  return Object.keys(engine?.getSnapshot().consent?.categories ?? {});
}

function services(category?: string) {
  const all = engine?.getSnapshot().dashboard?.services ?? [];
  return category
    ? all.filter((service) => service.category === category)
    : all;
}

/**
 * Start CookieChimp. The banner opens on its own when consent is needed.
 * Calling it again replaces the previous configuration.
 */
function run(options: CookieChimpOptions): Promise<void> {
  detach?.();
  engine?.destroy();
  const next = createEngine({
    ...options,
    onChange(preferences, categories, servicesChanged) {
      options.onChange?.(preferences, categories, servicesChanged);
      for (const listener of changeListeners)
        listener(preferences, categories, servicesChanged);
    },
  });
  engine = next;
  detach = next.subscribe(notify);
  notify();
  return next.start().catch((error: unknown) => {
    console.error("CookieChimp failed to start", error);
  });
}

/** The imperative CookieChimp API, matching the CookieChimp web banner. */
export const CookieChimp = {
  run,
  /** Show the consent banner. */
  show: () => engine?.showBanner(),
  hide: () => engine?.hideBanner(),
  showPreferences: () => engine?.showPreferences(),
  hidePreferences: () => engine?.hidePreferences(),
  /**
   * Accept categories: `'all'`, `[]` (necessary only) or a list of ids.
   * Categories not listed are rejected, and each category's services follow it.
   */
  acceptCategory(categories: "all" | readonly string[] | string) {
    const runtime = engine?.runtime();
    if (!runtime) return;
    if (categories === "all") return void runtime.acceptAll();
    const list = typeof categories === "string" ? [categories] : categories;
    if (!list.length) return void runtime.rejectAll();
    const accepted = new Set(list);
    runtime.set({
      categories: Object.fromEntries(
        categoryIds().map((id) => [id, accepted.has(id)]),
      ),
      services: Object.fromEntries(
        services().map(({ id, category }) => [id, accepted.has(category)]),
      ),
    });
  },
  /**
   * Accept services of one category by name or id: `'all'`, `[]` or a list.
   * Services not listed in that category are rejected.
   */
  acceptService(names: "all" | readonly string[] | string, category: string) {
    const runtime = engine?.runtime();
    if (!runtime) return;
    const list = typeof names === "string" && names !== "all" ? [names] : names;
    const wanted = new Set(
      list === "all" ? [] : [...list].map((name) => serviceId(name)),
    );
    const choices = Object.fromEntries(
      services(category).map(({ id }) => [
        id,
        list === "all" || wanted.has(id),
      ]),
    );
    runtime.set({
      categories: {
        [category]: Object.values(choices).some(Boolean),
      },
      services: choices,
    });
  },
  acceptedCategory: (category: string) =>
    engine?.runtime()?.has(category) === true,
  /** True when a service (by name or id) is allowed. */
  acceptedService(name: string, category?: string) {
    const runtime = engine?.runtime();
    const id = serviceId(name);
    if (!runtime) return false;
    const known = services(category).some((service) => service.id === id);
    return known
      ? runtime.hasService(id)
      : category !== undefined && runtime.has(category);
  },
  /** True once the user has made a choice that is still valid. */
  validConsent: () => store.getSnapshot().decided,
  getUserPreferences(): UserPreferences | null {
    const { consent, dashboard } = store.getSnapshot();
    return consent ? toUserPreferences(consent, dashboard) : null;
  },
  /** Listen for changed decisions. Returns an unsubscribe function. */
  onChange(listener: ChangeListener) {
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  },
  /** Forget the stored decision and show the banner again. */
  reset: () => engine?.reset(),
  /** Send queued consent records now. Resolves with the number still queued. */
  flush: () => engine?.flush() ?? Promise.resolve(0),
  registerVendor,
  unregisterVendor,
  startVendor,
  stopVendor,
  isVendorRunning,
  getVendors,
};

/** Stop the active engine, for example when its provider unmounts. */
export function shutdown() {
  detach?.();
  detach = undefined;
  engine?.destroy();
  engine = null;
  notify();
}

/** Test helper: stop the active engine and clear listeners. */
export function resetCookieChimp() {
  shutdown();
  changeListeners.clear();
}
