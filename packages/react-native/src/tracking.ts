import { AppState, Platform } from "react-native";
import { store } from "./api";
import { track } from "./events";
import { serviceId } from "./vendors";

/** The iOS App Tracking Transparency status, normalized across libraries. */
export type TrackingStatus =
  | "authorized"
  | "denied"
  | "restricted"
  | "not-determined"
  | "unavailable";

export interface TrackingOptions {
  /**
   * Shows the iOS tracking prompt and resolves with the result, for example
   * `requestTrackingPermissionsAsync` from `expo-tracking-transparency` or
   * `requestTrackingPermission` from `react-native-tracking-transparency`.
   * Once the user has answered, iOS resolves with the stored answer without
   * showing the prompt again.
   */
  request: () => Promise<unknown>;
  /** The category that must be accepted before the prompt. Defaults to `marketing`. */
  category?: string;
  /** Require this service (by dashboard name) instead of the category. */
  service?: string;
  /** Called with the status after each request, for example to tell an ads SDK. */
  onStatus?: (status: TrackingStatus) => void;
}

/** Read the result of the common ATT libraries as one status. */
export function trackingStatus(result: unknown): TrackingStatus {
  const value =
    result && typeof result === "object"
      ? (result as { status?: unknown }).status
      : result;
  switch (value) {
    case "authorized":
    case "granted":
      return "authorized";
    case "denied":
      return "denied";
    case "restricted":
      return "restricted";
    case "not-determined":
    case "undetermined":
      return "not-determined";
    default:
      return "unavailable";
  }
}

/**
 * Ask for iOS App Tracking Transparency permission after the user accepts
 * tracking in the consent banner. The prompt never shows while the category
 * (or service) is rejected or undecided, or on Android. It runs once per
 * launch when consent allows it, so `onStatus` also reports the stored answer
 * on later launches. Returns a function that stops listening.
 *
 * Consent in the banner never replaces the iOS permission: an SDK may only
 * use the advertising identifier when the status is `authorized`.
 */
export function requestTrackingAfterConsent(
  options: TrackingOptions,
): () => void {
  if (Platform.OS !== "ios") {
    options.onStatus?.("unavailable");
    return () => {};
  }
  const category = options.category ?? "marketing";
  let asked = false;
  let stopped = false;
  let waiting: { remove(): void } | undefined;
  const allowed = () => {
    const { consent, decided } = store.getSnapshot();
    if (!consent || !decided) return false;
    if (options.service) {
      const id = serviceId(options.service);
      if (consent.services?.[id] !== undefined)
        return consent.services[id] === true;
    }
    return consent.categories[category] === true;
  };
  const ask = () => {
    if (stopped || asked) return;
    asked = true;
    track("consent", "requesting App Tracking Transparency permission");
    Promise.resolve()
      .then(options.request)
      .then(
        (result) => {
          const status = trackingStatus(result);
          track("consent", `App Tracking Transparency: ${status}`);
          if (!stopped) options.onStatus?.(status);
        },
        (error: unknown) => {
          console.error("CookieChimp tracking request failed", error);
          if (!stopped) options.onStatus?.("unavailable");
        },
      );
  };
  const check = () => {
    if (asked || !allowed()) return;
    // iOS only shows the prompt while the app is active.
    if (AppState.currentState === "active") return ask();
    waiting ??= AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      waiting?.remove();
      waiting = undefined;
      if (allowed()) ask();
    });
  };
  const unsubscribe = store.subscribe(check);
  check();
  return () => {
    stopped = true;
    unsubscribe();
    waiting?.remove();
  };
}
