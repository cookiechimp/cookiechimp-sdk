import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieChimp, resetCookieChimp } from "./api";
import { debugEvents } from "./events";
import { connectFirebase, firebaseConsent } from "./firebase";
import { presets } from "./presets";
import { memoryStorage } from "./storage";
import { AppState, emitAppState, Platform } from "./test/react-native";
import {
  requestTrackingAfterConsent,
  type TrackingStatus,
  trackingStatus,
} from "./tracking";
import { clearVendors } from "./vendors";

const bundle = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;

const fetch = vi.fn(async () => Response.json({ synced: [], failed: [] }));
const start = (country = "DE") =>
  CookieChimp.run({
    config: bundle,
    country,
    storage: memoryStorage(),
    fetch,
  });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Platform.OS = "ios";
  AppState.currentState = "active";
  debugEvents.clear();
});
afterEach(() => {
  resetCookieChimp();
  clearVendors();
});

describe("vendor presets", () => {
  it("registers a preset under its dashboard name and follows consent", async () => {
    const mixpanel = { optInTracking: vi.fn(), optOutTracking: vi.fn() };
    CookieChimp.registerVendor(presets.mixpanel(mixpanel));
    // Mixpanel keeps its opt-in across launches, so it opts out until consent.
    expect(mixpanel.optOutTracking).toHaveBeenCalledTimes(1);
    await start();
    expect(CookieChimp.getVendors()).toEqual({
      Mixpanel: { category: "analytics", running: false },
    });
    CookieChimp.acceptCategory(["analytics"]);
    expect(mixpanel.optInTracking).toHaveBeenCalledTimes(1);
    CookieChimp.acceptCategory([]);
    expect(mixpanel.optOutTracking).toHaveBeenCalledTimes(2);
    expect(debugEvents.get().map((event) => event.message)).toEqual(
      expect.arrayContaining([
        "Mixpanel off until consent allows it",
        "Mixpanel started",
        "Mixpanel stopped",
      ]),
    );
  });

  it("lets the app override a preset's name and category", async () => {
    const amplitude = { setOptOut: vi.fn() };
    CookieChimp.registerVendor(presets.amplitude(amplitude), {
      category: "marketing",
    });
    await start();
    CookieChimp.acceptCategory(["analytics"]);
    expect(amplitude.setOptOut.mock.calls).toEqual([[true]]);
    CookieChimp.acceptCategory(["marketing"]);
    expect(amplitude.setOptOut).toHaveBeenLastCalledWith(false);
    expect(CookieChimp.getVendors().Amplitude?.category).toBe("marketing");
  });

  it("starts AppsFlyer once, then pauses and resumes it", async () => {
    const appsFlyer = { startSdk: vi.fn(), stop: vi.fn() };
    CookieChimp.registerVendor(presets.appsFlyer(appsFlyer));
    await start();
    CookieChimp.acceptCategory("all");
    CookieChimp.acceptCategory([]);
    CookieChimp.acceptCategory("all");
    expect(appsFlyer.startSdk).toHaveBeenCalledTimes(1);
    expect(appsFlyer.stop.mock.calls.map(([stopped]) => stopped)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it("initializes Adjust on the first consent when given its config", async () => {
    const adjust = { initSdk: vi.fn(), enable: vi.fn(), disable: vi.fn() };
    const config = { appToken: "token" };
    CookieChimp.registerVendor(presets.adjust(adjust, config));
    await start();
    CookieChimp.acceptCategory([]);
    expect(adjust.initSdk).not.toHaveBeenCalled();
    expect(adjust.disable).not.toHaveBeenCalled();
    CookieChimp.acceptCategory("all");
    CookieChimp.acceptCategory([]);
    CookieChimp.acceptCategory("all");
    expect(adjust.initSdk).toHaveBeenCalledTimes(1);
    expect(adjust.initSdk).toHaveBeenCalledWith(config);
    expect(adjust.enable).toHaveBeenCalledTimes(2);
    expect(adjust.disable).toHaveBeenCalledTimes(1);
  });

  it("initializes the Meta SDK on the first consent only", async () => {
    const settings = {
      initializeSDK: vi.fn(),
      setAutoLogAppEventsEnabled: vi.fn(),
      setAdvertiserIDCollectionEnabled: vi.fn(),
    };
    CookieChimp.registerVendor(presets.meta(settings));
    await start();
    CookieChimp.acceptCategory("all");
    CookieChimp.acceptCategory([]);
    CookieChimp.acceptCategory("all");
    expect(settings.initializeSDK).toHaveBeenCalledTimes(1);
    expect(settings.setAutoLogAppEventsEnabled.mock.calls).toEqual([
      [false],
      [true],
      [false],
      [true],
    ]);
    expect(settings.setAdvertiserIDCollectionEnabled).toHaveBeenLastCalledWith(
      true,
    );
  });

  it("supports both Adjust APIs and reports rejected vendor promises", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const v5 = { enable: vi.fn(), disable: vi.fn() };
    const v4 = {
      setEnabled: vi.fn(async () => {
        throw new Error("native module missing");
      }),
    };
    CookieChimp.registerVendor(presets.adjust(v5));
    CookieChimp.registerVendor(presets.adjust(v4), { name: "Adjust v4" });
    await start();
    CookieChimp.acceptCategory("all");
    await flush();
    expect(v5.enable).toHaveBeenCalled();
    expect(v4.setEnabled).toHaveBeenCalledWith(true);
    expect(error).toHaveBeenCalledWith(
      'CookieChimp vendor "Adjust" callback failed',
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("covers the other common SDKs", async () => {
    const branch = { disableTracking: vi.fn() };
    const braze = { enableSDK: vi.fn(), disableSDK: vi.fn() };
    const oneSignal = { setConsentGiven: vi.fn() };
    CookieChimp.registerVendor(presets.branch(branch));
    CookieChimp.registerVendor(presets.braze(braze));
    CookieChimp.registerVendor(presets.oneSignal(oneSignal));
    await start();
    CookieChimp.acceptCategory(["marketing"]);
    CookieChimp.acceptCategory([]);
    expect(branch.disableTracking.mock.calls).toEqual([
      [true],
      [false],
      [true],
    ]);
    expect(braze.enableSDK).toHaveBeenCalledTimes(1);
    expect(braze.disableSDK).toHaveBeenCalledTimes(2);
    expect(oneSignal.setConsentGiven.mock.calls).toEqual([
      [false],
      [true],
      [false],
    ]);
  });
});

describe("connectFirebase", () => {
  const firebase = () => ({
    analytics: {
      setAnalyticsCollectionEnabled: vi.fn(),
      setConsent: vi.fn(async () => {}),
    },
    crashlytics: { setCrashlyticsCollectionEnabled: vi.fn() },
    performance: { setPerformanceCollectionEnabled: vi.fn() },
  });

  it("maps categories to Consent Mode signals like the web SDK", () => {
    expect(firebaseConsent({ analytics: true, marketing: false })).toEqual({
      analytics_storage: true,
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
    });
    expect(
      firebaseConsent({ ads: true }, { ads: ["ad_storage", "ad_user_data"] }),
    ).toEqual({
      analytics_storage: false,
      ad_storage: true,
      ad_user_data: true,
      ad_personalization: false,
    });
  });

  it("denies every signal under GDPR until the user decides, then follows the decision", async () => {
    const { analytics, crashlytics, performance } = firebase();
    connectFirebase({ analytics, crashlytics, performance });
    expect(analytics.setConsent).not.toHaveBeenCalled();
    await start("DE");
    expect(analytics.setConsent).toHaveBeenLastCalledWith({
      analytics_storage: false,
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
    });
    // Crashlytics is essential in the mobile library, so it runs at once.
    expect(crashlytics.setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(
      true,
    );
    // Firebase keeps the collection setting across launches, so it is
    // switched off until consent allows it.
    expect(analytics.setAnalyticsCollectionEnabled.mock.calls).toEqual([
      [false],
    ]);
    CookieChimp.acceptCategory(["analytics"]);
    expect(analytics.setConsent).toHaveBeenLastCalledWith({
      analytics_storage: true,
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
    });
    expect(analytics.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
      true,
    );
    expect(
      performance.setPerformanceCollectionEnabled,
    ).toHaveBeenLastCalledWith(true);
    const calls = analytics.setConsent.mock.calls.length;
    CookieChimp.show();
    expect(analytics.setConsent).toHaveBeenCalledTimes(calls);
  });

  it("grants opt-out defaults where the banner is opt-out", async () => {
    const { analytics } = firebase();
    connectFirebase({ analytics });
    await start("US-CA");
    expect(analytics.setConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({ analytics_storage: true, ad_storage: true }),
    );
  });

  it("can skip Consent Mode, move a product and disconnect", async () => {
    const { analytics, crashlytics } = firebase();
    const disconnect = connectFirebase({
      analytics,
      crashlytics,
      consentMode: false,
      categories: { crashlytics: "analytics" },
    });
    await start();
    expect(analytics.setConsent).not.toHaveBeenCalled();
    expect(crashlytics.setCrashlyticsCollectionEnabled.mock.calls).toEqual([
      [false],
    ]);
    disconnect();
    expect(CookieChimp.getVendors()).toEqual({});
  });
});

describe("requestTrackingAfterConsent", () => {
  it("normalizes the common ATT libraries", () => {
    expect(trackingStatus({ status: "granted", granted: true })).toBe(
      "authorized",
    );
    expect(trackingStatus({ status: "undetermined" })).toBe("not-determined");
    expect(trackingStatus("authorized")).toBe("authorized");
    expect(trackingStatus("restricted")).toBe("restricted");
    expect(trackingStatus("denied")).toBe("denied");
    expect(trackingStatus("unavailable")).toBe("unavailable");
    expect(trackingStatus(undefined)).toBe("unavailable");
  });

  it("asks only after the marketing category is accepted, once", async () => {
    const request = vi.fn(async () => ({ status: "granted" }));
    const statuses: TrackingStatus[] = [];
    requestTrackingAfterConsent({
      request,
      onStatus: (status) => statuses.push(status),
    });
    await start();
    expect(request).not.toHaveBeenCalled();
    CookieChimp.acceptCategory(["analytics"]);
    expect(request).not.toHaveBeenCalled();
    CookieChimp.acceptCategory("all");
    CookieChimp.acceptCategory([]);
    CookieChimp.acceptCategory("all");
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["authorized"]);
  });

  it("never asks while opt-out defaults are undecided", async () => {
    const request = vi.fn(async () => "authorized");
    requestTrackingAfterConsent({ request });
    await start("US-CA");
    expect(request).not.toHaveBeenCalled();
  });

  it("can require a service and waits until the app is active", async () => {
    const request = vi.fn(async () => "denied");
    const onStatus = vi.fn();
    AppState.currentState = "background";
    requestTrackingAfterConsent({ request, service: "Meta Pixel", onStatus });
    await start();
    CookieChimp.acceptService([], "marketing");
    CookieChimp.acceptCategory(["marketing"]);
    expect(request).not.toHaveBeenCalled();
    emitAppState("active");
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith("denied");
  });

  it("does nothing on Android", async () => {
    Platform.OS = "android";
    const request = vi.fn();
    const onStatus = vi.fn();
    requestTrackingAfterConsent({ request, onStatus });
    await start();
    CookieChimp.acceptCategory("all");
    expect(request).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith("unavailable");
  });
});
