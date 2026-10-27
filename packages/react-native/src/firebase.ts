import { store } from "./api";
import {
  type FirebaseAnalyticsLike,
  type FirebaseCrashlyticsLike,
  type FirebasePerformanceLike,
  presets,
} from "./presets";
import { registerVendor, unregisterVendor } from "./vendors";

/** The Consent Mode v2 signals Firebase Analytics accepts. */
export type FirebaseConsentSignal =
  | "analytics_storage"
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization";

/** Category id to the signals it grants. */
export type FirebaseConsentMapping = Readonly<
  Record<string, readonly FirebaseConsentSignal[]>
>;

/** The same category mapping the web SDK uses for Google Consent Mode. */
export const DEFAULT_CONSENT_MAPPING: FirebaseConsentMapping = {
  analytics: ["analytics_storage"],
  marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
  advertising: ["ad_storage", "ad_user_data", "ad_personalization"],
};

const SIGNALS: readonly FirebaseConsentSignal[] = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
];

export interface FirebaseOptions {
  /** `analytics()` from `@react-native-firebase/analytics`. */
  analytics?: FirebaseAnalyticsLike;
  /** `crashlytics()` from `@react-native-firebase/crashlytics`. */
  crashlytics?: FirebaseCrashlyticsLike;
  /** `perf()` from `@react-native-firebase/perf`. */
  performance?: FirebasePerformanceLike;
  /**
   * Send Consent Mode v2 signals with `analytics.setConsent`. Defaults to
   * true; pass a mapping to change which categories grant which signals.
   */
  consentMode?: boolean | FirebaseConsentMapping;
  /** Override the category of a product, for example `{ crashlytics: "analytics" }`. */
  categories?: Partial<
    Record<"analytics" | "crashlytics" | "performance", string>
  >;
}

/** The Consent Mode signals for a set of category decisions. */
export function firebaseConsent(
  categories: Readonly<Record<string, boolean>>,
  mapping: FirebaseConsentMapping = DEFAULT_CONSENT_MAPPING,
): Record<FirebaseConsentSignal, boolean> {
  const result = Object.fromEntries(
    SIGNALS.map((signal) => [signal, false]),
  ) as Record<FirebaseConsentSignal, boolean>;
  for (const [category, signals] of Object.entries(mapping))
    if (categories[category] === true)
      for (const signal of signals) result[signal] = true;
  return result;
}

/**
 * Connect Firebase to consent: Analytics, Crashlytics and Performance
 * collection follow their services (or categories), and Analytics receives
 * Consent Mode v2 signals on launch and after every decision. Set the native
 * defaults to off so nothing is collected before the SDK is ready. Returns a
 * function that disconnects Firebase.
 */
export function connectFirebase(options: FirebaseOptions): () => void {
  const registered: string[] = [];
  const add = (
    product: "analytics" | "crashlytics" | "performance",
    vendor: ReturnType<(typeof presets)["firebaseAnalytics"]> | undefined,
  ) => {
    if (!vendor) return;
    const category = options.categories?.[product];
    registerVendor(vendor, category ? { category } : undefined);
    registered.push(vendor.name);
  };
  add(
    "analytics",
    options.analytics && presets.firebaseAnalytics(options.analytics),
  );
  add(
    "crashlytics",
    options.crashlytics && presets.firebaseCrashlytics(options.crashlytics),
  );
  add(
    "performance",
    options.performance && presets.firebasePerformance(options.performance),
  );
  const analytics = options.analytics;
  let unsubscribe: (() => void) | undefined;
  if (analytics?.setConsent && options.consentMode !== false) {
    const mapping =
      typeof options.consentMode === "object"
        ? options.consentMode
        : DEFAULT_CONSENT_MAPPING;
    let last = "";
    const sync = () => {
      const consent = store.getSnapshot().consent;
      // Before the SDK is ready the native defaults apply.
      if (!consent) return;
      const signals = firebaseConsent(consent.categories, mapping);
      const key = JSON.stringify(signals);
      if (key === last) return;
      last = key;
      try {
        const result = analytics.setConsent?.(signals);
        if (result && typeof (result as Promise<unknown>).then === "function")
          (result as Promise<unknown>).catch((error: unknown) => {
            console.error("CookieChimp could not set Firebase consent", error);
          });
      } catch (error) {
        console.error("CookieChimp could not set Firebase consent", error);
      }
    };
    unsubscribe = store.subscribe(sync);
    sync();
  }
  return () => {
    unsubscribe?.();
    for (const name of registered) unregisterVendor(name);
  };
}
