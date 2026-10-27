import type { VendorPreset } from "./vendors";

// Vendor SDK methods may return promises; a rejected one must not surface as
// an unhandled rejection from inside a consent change.
const settle = (name: string, value: unknown) => {
  if (value && typeof (value as Promise<unknown>).then === "function")
    (value as Promise<unknown>).catch((error: unknown) => {
      console.error(`CookieChimp vendor "${name}" callback failed`, error);
    });
};

function preset(
  name: string,
  category: string,
  onStart: () => unknown,
  onStop: () => unknown,
): VendorPreset {
  return {
    name,
    category,
    onStart: () => settle(name, onStart()),
    onStop: () => settle(name, onStop()),
  };
}

/** `analytics()` from `@react-native-firebase/analytics`. */
export interface FirebaseAnalyticsLike {
  setAnalyticsCollectionEnabled(enabled: boolean): unknown;
  /** Consent Mode v2 signals. Used by `connectFirebase`. */
  setConsent?(settings: Record<string, boolean>): unknown;
}

/** `crashlytics()` from `@react-native-firebase/crashlytics`. */
export interface FirebaseCrashlyticsLike {
  setCrashlyticsCollectionEnabled(enabled: boolean): unknown;
}

/** `perf()` from `@react-native-firebase/perf`. */
export interface FirebasePerformanceLike {
  setPerformanceCollectionEnabled(enabled: boolean): unknown;
}

/** The default export of `react-native-appsflyer`. */
export interface AppsFlyerLike {
  startSdk(): unknown;
  stop(isStopped: boolean, callback?: (result: unknown) => void): unknown;
}

/** `Adjust` from `react-native-adjust` (v5 `initSdk`, `enable`/`disable`; v4 `create`, `setEnabled`). */
export interface AdjustLike {
  initSdk?(config: unknown): unknown;
  create?(config: unknown): unknown;
  enable?(): unknown;
  disable?(): unknown;
  setEnabled?(enabled: boolean): unknown;
}

/** `Settings` from `react-native-fbsdk-next`. */
export interface MetaSettingsLike {
  setAutoLogAppEventsEnabled(enabled: boolean): unknown;
  setAdvertiserIDCollectionEnabled?(enabled: boolean): unknown;
  initializeSDK?(): unknown;
}

/** A client from `@amplitude/analytics-react-native` (or the module itself). */
export interface AmplitudeLike {
  setOptOut(optOut: boolean): unknown;
}

/** A `Mixpanel` instance from `mixpanel-react-native`. */
export interface MixpanelLike {
  optInTracking(): unknown;
  optOutTracking(): unknown;
}

/** The default export of `react-native-branch`. */
export interface BranchLike {
  disableTracking(disable: boolean): unknown;
}

/** The default export of `@braze/react-native-sdk`. */
export interface BrazeLike {
  enableSDK(): unknown;
  disableSDK(): unknown;
}

/** `OneSignal` from `react-native-onesignal` (v5). */
export interface OneSignalLike {
  setConsentGiven(given: boolean): unknown;
}

const noop = () => {};

/**
 * Ready-made vendors for common mobile SDKs. Each one uses the service name
 * and category from CookieChimp's mobile SDK library, so a vendor added from
 * the dashboard library follows the user's choice for that service. Pass the
 * result to `CookieChimp.registerVendor`. Turn off each SDK's automatic
 * collection in its own setup so nothing runs before consent.
 */
export const presets = {
  /** Analytics collection on and off. Start with collection disabled. */
  firebaseAnalytics: (analytics: FirebaseAnalyticsLike) =>
    preset(
      "Firebase Analytics",
      "analytics",
      () => analytics.setAnalyticsCollectionEnabled(true),
      () => analytics.setAnalyticsCollectionEnabled(false),
    ),
  /** Crash reporting on and off. Essential by default, like the library. */
  firebaseCrashlytics: (crashlytics: FirebaseCrashlyticsLike) =>
    preset(
      "Firebase Crashlytics",
      "essential",
      () => crashlytics.setCrashlyticsCollectionEnabled(true),
      () => crashlytics.setCrashlyticsCollectionEnabled(false),
    ),
  firebasePerformance: (performance: FirebasePerformanceLike) =>
    preset(
      "Firebase Performance Monitoring",
      "analytics",
      () => performance.setPerformanceCollectionEnabled(true),
      () => performance.setPerformanceCollectionEnabled(false),
    ),
  /**
   * Initialize AppsFlyer with `manualStart: true`. The SDK starts on the first
   * consent and is stopped and resumed with `stop()` afterwards.
   */
  appsFlyer(appsFlyer: AppsFlyerLike) {
    let started = false;
    return preset(
      "AppsFlyer",
      "marketing",
      () => {
        appsFlyer.stop(false, noop);
        if (started) return;
        started = true;
        return appsFlyer.startSdk();
      },
      () => appsFlyer.stop(true, noop),
    );
  },
  /**
   * Pass your `AdjustConfig` instead of initializing Adjust yourself: Adjust
   * sends data as soon as it is initialized, so the preset initializes it on
   * the first consent. Without a config, Adjust is only enabled and disabled.
   */
  adjust(adjust: AdjustLike, config?: unknown) {
    let initialized = config === undefined;
    return preset(
      "Adjust",
      "marketing",
      () => {
        if (!initialized) {
          initialized = true;
          settle(
            "Adjust",
            adjust.initSdk ? adjust.initSdk(config) : adjust.create?.(config),
          );
        }
        return adjust.enable ? adjust.enable() : adjust.setEnabled?.(true);
      },
      () => {
        if (!initialized) return;
        return adjust.disable ? adjust.disable() : adjust.setEnabled?.(false);
      },
    );
  },
  /**
   * Meta (Facebook) SDK events and advertiser ID collection. Set
   * `FacebookAutoInitEnabled` and `FacebookAutoLogAppEventsEnabled` to false;
   * the first consent calls `initializeSDK()`.
   */
  meta(settings: MetaSettingsLike) {
    let initialized = false;
    return preset(
      "Facebook SDK",
      "marketing",
      () => {
        if (!initialized) {
          initialized = true;
          settings.initializeSDK?.();
        }
        settings.setAutoLogAppEventsEnabled(true);
        return settings.setAdvertiserIDCollectionEnabled?.(true);
      },
      () => {
        settings.setAutoLogAppEventsEnabled(false);
        return settings.setAdvertiserIDCollectionEnabled?.(false);
      },
    );
  },
  /** Initialize Amplitude with `optOut: true`. */
  amplitude: (amplitude: AmplitudeLike) =>
    preset(
      "Amplitude",
      "analytics",
      () => amplitude.setOptOut(false),
      () => amplitude.setOptOut(true),
    ),
  /** Create Mixpanel with `optOutTrackingDefault` set to true. */
  mixpanel: (mixpanel: MixpanelLike) =>
    preset(
      "Mixpanel",
      "analytics",
      () => mixpanel.optInTracking(),
      () => mixpanel.optOutTracking(),
    ),
  /** Call `branch.disableTracking(true)` at launch, before consent. */
  branch: (branch: BranchLike) =>
    preset(
      "Branch",
      "marketing",
      () => branch.disableTracking(false),
      () => branch.disableTracking(true),
    ),
  braze: (braze: BrazeLike) =>
    preset(
      "Braze",
      "marketing",
      () => braze.enableSDK(),
      () => braze.disableSDK(),
    ),
  /** Call `OneSignal.setConsentRequired(true)` before `initialize`. */
  oneSignal: (oneSignal: OneSignalLike) =>
    preset(
      "OneSignal",
      "marketing",
      () => oneSignal.setConsentGiven(true),
      () => oneSignal.setConsentGiven(false),
    ),
} as const;
