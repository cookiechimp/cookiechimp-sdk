import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieChimp, resetCookieChimp, store } from "./api";
import type { CookieChimpOptions } from "./engine";
import { type AsyncKeyValueStorage, memoryStorage } from "./storage";
import { emitAppState, Platform } from "./test/react-native";
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
const ACCOUNT = bundle.account_hashid as string;
const API = "https://cookiechimp.com/api/v1/mobile-sdk";

type Call = [string, RequestInit | undefined];

/** A fake platform: geolocation, the offline bundle with ETags, and sync. */
function platform(
  options: { geo?: unknown; config?: unknown; configStatus?: number } = {},
) {
  const synced: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${API}/geolocation/${ACCOUNT}`)
      return Response.json(options.geo ?? { country: "DE", region: null });
    if (url === `${API}/offline/${ACCOUNT}`) {
      if (options.configStatus)
        return new Response("{}", { status: options.configStatus });
      const config = (options.config ?? bundle) as { cache_version: string };
      if (
        new Headers(init?.headers).get("If-None-Match") ===
        `"${config.cache_version}"`
      )
        return new Response(null, { status: 304 });
      return Response.json(config, {
        headers: { ETag: `"${config.cache_version}"` },
      });
    }
    if (url === `${API}/sync/${ACCOUNT}`) {
      const { consents } = JSON.parse(String(init?.body)) as {
        consents: Record<string, unknown>[];
      };
      synced.push(...consents);
      return Response.json({
        synced: consents.map(({ client_id }) => ({ client_id })),
        failed: [],
      });
    }
    return new Response("not found", { status: 404 });
  });
  return { fetch, synced, calls: () => fetch.mock.calls as Call[] };
}

let storage: AsyncKeyValueStorage;
const start = async (options: CookieChimpOptions) => {
  await CookieChimp.run({ storage, ...options });
  return store.getSnapshot();
};

beforeEach(() => {
  storage = memoryStorage();
  Platform.OS = "ios";
});
afterEach(() => {
  resetCookieChimp();
  clearVendors();
});

describe("offline mode", () => {
  it("selects the banner for the country without any config request", async () => {
    const api = platform();
    const state = await start({
      config: bundle,
      country: "DE",
      fetch: api.fetch,
    });
    expect(state.status).toBe("ready");
    expect(state.dashboard?.bannerId).toBe("bnrEU1");
    expect(state.regulation).toBe("gdpr");
    expect(state.bannerOpen).toBe(true);
    expect(state.decided).toBe(false);
    expect(api.calls().map(([url]) => url)).toEqual([]);
  });

  it("shows the default banner with GDPR rules when no country is known", async () => {
    const vendor = { onStart: vi.fn() };
    CookieChimp.registerVendor("Google Analytics", "analytics", vendor);
    const state = await start({ config: bundle, fetch: platform().fetch });
    // The default banner is opt-out, but an unknown region is never treated as
    // opt-out: nothing optional runs before a choice.
    expect(state.dashboard?.bannerId).toBe("bnrUS1");
    expect(state.region).toBeNull();
    expect(state.regulation).toBe("gdpr");
    expect(state.bannerOpen).toBe(true);
    expect(CookieChimp.acceptedCategory("analytics")).toBe(false);
    expect(vendor.onStart).not.toHaveBeenCalled();
  });

  it("uses opt-out rules once the app supplies a US region", async () => {
    const state = await start({
      config: bundle,
      country: "US-CA",
      fetch: platform().fetch,
    });
    expect(state.regulation).toBe("ccpa");
    // Opt-out banners still ask once so the user sees the notice.
    expect(state.bannerOpen).toBe(true);
    expect(CookieChimp.acceptedCategory("analytics")).toBe(true);
  });

  it("stores a decision, delivers a consent record and restores it on the next launch", async () => {
    const api = platform();
    const first = vi.fn();
    const accept = vi.fn();
    await start({
      config: bundle,
      country: "DE",
      fetch: api.fetch,
      onFirstConsent: first,
      onAccept: accept,
    });
    CookieChimp.acceptCategory("all");
    expect(store.getSnapshot()).toMatchObject({
      decided: true,
      bannerOpen: false,
    });
    expect(first).toHaveBeenCalledWith(
      expect.objectContaining({ acceptType: "all" }),
    );
    expect(accept).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(api.synced).toHaveLength(1));
    expect(api.synced[0]).toMatchObject({
      platform: "ios",
      visitor_action: "consent",
      consent_banner_hashid: "bnrEU1",
      user_preferences: { acceptType: "all" },
    });
    expect(api.synced[0]).not.toHaveProperty("device_identifier");
    const consentId = CookieChimp.getUserPreferences()?.consentId;
    resetCookieChimp();

    const relaunchAccept = vi.fn();
    const state = await start({
      config: bundle,
      country: "DE",
      fetch: api.fetch,
      onAccept: relaunchAccept,
    });
    expect(state).toMatchObject({ decided: true, bannerOpen: false });
    expect(CookieChimp.acceptedCategory("analytics")).toBe(true);
    expect(CookieChimp.getUserPreferences()?.consentId).toBe(consentId);
    expect(relaunchAccept).toHaveBeenCalledTimes(1);
  });

  it("tags records from Android", async () => {
    Platform.OS = "android";
    const api = platform();
    await start({ config: bundle, country: "DE", fetch: api.fetch });
    CookieChimp.acceptCategory([]);
    await vi.waitFor(() => expect(api.synced).toHaveLength(1));
    expect(api.synced[0]).toMatchObject({
      platform: "android",
      user_preferences: { acceptType: "necessary" },
    });
  });

  it("asks again when the dashboard requires re-consent after the stored decision", async () => {
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
    CookieChimp.acceptCategory("all");
    resetCookieChimp();
    const later = {
      ...bundle,
      reconsent_required_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const state = await start({
      config: later,
      country: "DE",
      fetch: platform().fetch,
    });
    expect(state).toMatchObject({ decided: false, bannerOpen: true });
    expect(CookieChimp.acceptedCategory("analytics")).toBe(false);
  });

  it("reports an invalid bundle without throwing", async () => {
    const state = await start({ config: { nope: true } });
    expect(state).toMatchObject({ status: "error", error: "invalid config" });
  });

  it("keeps consent records local when syncConsents is false", async () => {
    const api = platform();
    await start({
      config: bundle,
      country: "DE",
      fetch: api.fetch,
      syncConsents: false,
    });
    CookieChimp.acceptCategory("all");
    await CookieChimp.flush();
    expect(api.synced).toHaveLength(0);
  });
});

describe("connected mode", () => {
  it("uses the CookieChimp geolocation endpoint when opted in, then caches config", async () => {
    const api = platform({ geo: { country: "US", region: "US-CA" } });
    const state = await start({
      accountId: ACCOUNT,
      geolocation: true,
      fetch: api.fetch,
    });
    expect(state.regulation).toBe("ccpa");
    expect(state.status).toBe("ready");
    expect(state.region).toEqual({ country: "US", region: "CA" });
    expect(state.dashboard?.bannerId).toBe("bnrUS1");
    expect(api.calls().map(([url]) => url)).toEqual([
      `${API}/geolocation/${ACCOUNT}`,
      `${API}/offline/${ACCOUNT}`,
    ]);
    for (const [, init] of api.calls()) expect(init?.credentials).toBe("omit");
    resetCookieChimp();

    // The next launch renders from the cache and revalidates with the ETag.
    api.fetch.mockClear();
    const cached = await start({
      accountId: ACCOUNT,
      country: "US-CA",
      fetch: api.fetch,
    });
    expect(cached.status).toBe("ready");
    await vi.waitFor(() =>
      expect(api.calls().map(([url]) => url)).toContain(
        `${API}/offline/${ACCOUNT}`,
      ),
    );
    const revalidation = api.calls().find(([url]) => url.includes("/offline/"));
    expect(new Headers(revalidation?.[1]?.headers).get("If-None-Match")).toBe(
      `"${bundle.cache_version}"`,
    );
  });

  it("never looks up the location by default or when a country is given", async () => {
    for (const options of [
      {},
      { geolocation: false },
      { country: "FR", geolocation: true },
    ]) {
      const api = platform();
      storage = memoryStorage();
      await start({ accountId: ACCOUNT, fetch: api.fetch, ...options });
      expect(api.calls().some(([url]) => url.includes("/geolocation/"))).toBe(
        false,
      );
      resetCookieChimp();
    }
  });

  it("applies a newer dashboard config found when the app returns to the foreground", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const api = platform();
      await start({ accountId: ACCOUNT, country: "DE", fetch: api.fetch });
      const updated = {
        ...bundle,
        cache_version: "next1",
        translations: {
          ...(bundle.translations as Record<string, unknown>),
          bnrEU1: {
            en: { consent_modal: { title: "Updated title" } },
          },
        },
      };
      api.fetch.mockImplementation(platform({ config: updated }).fetch);
      vi.setSystemTime(Date.now() + 6 * 60_000);
      emitAppState("active");
      await vi.waitFor(() =>
        expect(store.getSnapshot().dashboard?.configVersion).toBe("next1"),
      );
      const copy = store.getSnapshot().dashboard?.copy;
      expect(copy?.consent_modal).toMatchObject({ title: "Updated title" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays out of the way when config cannot be loaded on first launch, then recovers on foreground", async () => {
    const api = platform({ configStatus: 500 });
    const state = await start({
      accountId: ACCOUNT,
      country: "DE",
      fetch: api.fetch,
    });
    expect(state).toMatchObject({ status: "error", bannerOpen: false });
    expect(CookieChimp.acceptedCategory("analytics")).toBe(false);

    api.fetch.mockImplementation(platform().fetch);
    emitAppState("active");
    await vi.waitFor(() =>
      expect(store.getSnapshot()).toMatchObject({
        status: "ready",
        bannerOpen: true,
      }),
    );
  });

  it("requires an account ID or a bundle", async () => {
    const state = await start({});
    expect(state).toMatchObject({ status: "error" });
  });
});

describe("CookieChimp API", () => {
  beforeEach(async () => {
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
  });

  it("accepts a list of categories and their services", () => {
    CookieChimp.acceptCategory(["analytics"]);
    expect(CookieChimp.acceptedCategory("analytics")).toBe(true);
    expect(CookieChimp.acceptedCategory("marketing")).toBe(false);
    expect(CookieChimp.acceptedService("Google Analytics", "analytics")).toBe(
      true,
    );
    expect(CookieChimp.acceptedService("Meta Pixel", "marketing")).toBe(false);
    expect(CookieChimp.getUserPreferences()).toMatchObject({
      acceptType: "custom",
      acceptedCategories: expect.arrayContaining(["necessary", "analytics"]),
      rejectedCategories: ["marketing"],
      acceptedServices: {
        analytics: ["google-analytics", "microsoft-clarity"],
      },
      rejectedServices: { marketing: ["meta-pixel"] },
    });
  });

  it("accepts individual services by name", () => {
    CookieChimp.acceptService(["Microsoft Clarity"], "analytics");
    expect(CookieChimp.acceptedService("Microsoft Clarity", "analytics")).toBe(
      true,
    );
    expect(CookieChimp.acceptedService("Google Analytics", "analytics")).toBe(
      false,
    );
    expect(CookieChimp.acceptedCategory("analytics")).toBe(true);
    CookieChimp.acceptService([], "analytics");
    expect(CookieChimp.acceptedCategory("analytics")).toBe(false);
  });

  it("reports changed categories and services to onChange listeners", () => {
    const listener = vi.fn();
    const stop = CookieChimp.onChange(listener);
    CookieChimp.acceptCategory("all");
    expect(listener).not.toHaveBeenCalled();
    CookieChimp.acceptCategory(["analytics"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ acceptType: "custom" }),
      ["marketing"],
      ["meta-pixel"],
    );
    stop();
  });

  it("shows and hides the banner and preferences", () => {
    CookieChimp.showPreferences();
    expect(store.getSnapshot().preferencesOpen).toBe(true);
    CookieChimp.hidePreferences();
    CookieChimp.hide();
    expect(store.getSnapshot()).toMatchObject({
      bannerOpen: false,
      preferencesOpen: false,
    });
    CookieChimp.show();
    expect(store.getSnapshot().bannerOpen).toBe(true);
  });

  it("forgets the decision on reset", () => {
    CookieChimp.acceptCategory("all");
    expect(CookieChimp.validConsent()).toBe(true);
    CookieChimp.reset();
    expect(CookieChimp.validConsent()).toBe(false);
    expect(store.getSnapshot().bannerOpen).toBe(true);
    expect(CookieChimp.acceptedCategory("analytics")).toBe(false);
  });
});

describe("vendors", () => {
  it("starts and stops registered vendors as consent changes", async () => {
    resetCookieChimp();
    const analytics = { onStart: vi.fn(), onStop: vi.fn() };
    const pixel = { onStart: vi.fn(), onStop: vi.fn() };
    const crash = { onStart: vi.fn(), onStop: vi.fn() };
    CookieChimp.registerVendor("Google Analytics", "analytics", analytics);
    CookieChimp.registerVendor("Meta Pixel", "marketing", pixel);
    // Not a dashboard service: follows its category.
    CookieChimp.registerVendor("Crash Reporter", "analytics", crash);
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
    // GDPR: nothing runs before a decision.
    expect(analytics.onStart).not.toHaveBeenCalled();
    expect(CookieChimp.isVendorRunning("Google Analytics")).toBe(false);

    CookieChimp.acceptCategory(["analytics"]);
    expect(analytics.onStart).toHaveBeenCalledTimes(1);
    expect(crash.onStart).toHaveBeenCalledTimes(1);
    expect(pixel.onStart).not.toHaveBeenCalled();
    expect(CookieChimp.getVendors()).toEqual({
      "Google Analytics": { category: "analytics", running: true },
      "Meta Pixel": { category: "marketing", running: false },
      "Crash Reporter": { category: "analytics", running: true },
    });

    CookieChimp.acceptService(["Microsoft Clarity"], "analytics");
    expect(analytics.onStop).toHaveBeenCalledTimes(1);
    expect(crash.onStop).not.toHaveBeenCalled();

    CookieChimp.acceptCategory([]);
    expect(crash.onStop).toHaveBeenCalledTimes(1);
  });

  it("starts a vendor registered after consent was given", async () => {
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
    CookieChimp.acceptCategory("all");
    const onStart = vi.fn();
    CookieChimp.registerVendor("Meta Pixel", "marketing", { onStart });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("isolates a failing vendor callback", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    CookieChimp.registerVendor("Google Analytics", "analytics", {
      onStart: () => {
        throw new Error("boom");
      },
    });
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
    expect(() => CookieChimp.acceptCategory("all")).not.toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("storage", () => {
  it("namespaces keys and survives a failing backing store", async () => {
    await start({ config: bundle, country: "DE", fetch: platform().fetch });
    CookieChimp.acceptCategory("all");
    await vi.waitFor(async () =>
      expect(await storage.getAllKeys?.()).toContain(
        "@cookiechimp:cookiechimp_pref_REDACTED",
      ),
    );
    resetCookieChimp();
    storage = {
      getItem: () => Promise.reject(new Error("locked")),
      setItem: () => Promise.reject(new Error("full")),
      removeItem: () => Promise.reject(new Error("full")),
      getAllKeys: () => Promise.reject(new Error("locked")),
    };
    const state = await start({
      config: bundle,
      country: "DE",
      fetch: platform().fetch,
    });
    expect(state.bannerOpen).toBe(true);
    expect(() => CookieChimp.acceptCategory("all")).not.toThrow();
  });
});
