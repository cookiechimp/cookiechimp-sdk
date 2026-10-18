import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_SCHEMA_VERSION,
  type ConsentState,
  createConsent,
  createEmitter,
  decodeConsentCookie,
  encodeConsentCookie,
  readConsentCookie,
  VERSION,
} from "./index";
import { regulationFor } from "./regions";

const state = (id = "abcdefghijklmnop"): ConsentState => ({
  schemaVersion: CONSENT_SCHEMA_VERSION,
  consentId: id,
  ts: "2026-10-12T12:00:00.000Z",
  categories: { necessary: true, analytics: false },
  action: "custom",
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cookie codec", () => {
  it("round trips compact, Unicode category data", () => {
    const input = state();
    input.categories.métrique = true;
    const encoded = encodeConsentCookie(input);
    expect(encoded.startsWith("v1.")).toBe(true);
    expect(encoded.length).toBeLessThan(500);
    expect(decodeConsentCookie(encoded)).toEqual(input);
  });

  it("stores the schema version, consent id, and timestamp", () => {
    const input = state();
    const payload = decodeConsentCookie(encodeConsentCookie(input));
    expect(payload).toMatchObject({
      schemaVersion: 1,
      consentId: "abcdefghijklmnop",
      ts: "2026-10-12T12:00:00.000Z",
    });
  });

  it.each(["", "v2.abc", "v1.!", "v1.e30", `v1.${"a".repeat(3800)}`])(
    "safely rejects %s",
    (value) => expect(decodeConsentCookie(value)).toBeNull(),
  );

  it("finds an encoded consent among several server cookies", () => {
    const encoded = encodeURIComponent(encodeConsentCookie(state()));
    expect(
      readConsentCookie(`theme=dark; cc_consent=${encoded}; session=x`),
    ).toEqual(state());
    expect(readConsentCookie("cc_consent=%E0%A4%A")).toBeNull();
    expect(readConsentCookie("other=value")).toBeNull();
  });
});

describe("emitter", () => {
  it("unsubscribes and isolates listener errors", () => {
    const emitter = createEmitter<number>();
    const first = vi.fn(() => {
      throw new Error("consumer error");
    });
    const second = vi.fn();
    emitter.subscribe(first);
    const unsubscribe = emitter.subscribe(second);
    emitter.emit(1);
    unsubscribe();
    emitter.emit(2);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledOnce();
  });
});

describe("createConsent", () => {
  it("applies regulation defaults and decision visibility", () => {
    const gdpr = createConsent({
      categories: { analytics: true },
      region: { country: "DE" },
    });
    expect(gdpr.get().categories.analytics).toBe(false);
    expect(gdpr.needsDecision).toBe(true);
    gdpr.acceptAll();
    expect(gdpr.needsDecision).toBe(false);

    const ccpa = createConsent({
      categories: { analytics: false },
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
    });
    expect(ccpa.get().categories.analytics).toBe(true);
    expect(ccpa.needsDecision).toBe(false);
    expect(ccpa.showOptOut).toBe(true);

    const none = createConsent({
      categories: { analytics: true },
      region: { country: "JP" },
      regulation: "none",
    });
    expect(none.get().categories.analytics).toBe(true);
    expect(none.needsDecision).toBe(false);
  });

  it("supports regulation and region-table overrides", () => {
    expect(
      createConsent({
        categories: [],
        region: { country: "JP" },
        regulation: () => "ccpa",
      }).regulation,
    ).toBe("ccpa");
    expect(
      createConsent({
        categories: [],
        region: { country: "US", region: "NY" },
        regions: { "US-NY": "ccpa" },
      }).regulation,
    ).toBe("ccpa");
    expect(
      createConsent({ categories: [], fallbackRegulation: "none" }).regulation,
    ).toBe("none");
  });

  it("accepts a resolveRegulation option so region alone selects a rule", () => {
    const resolveRegulation = (region: { country: string } | null) =>
      region?.country === "US" ? ("ccpa" as const) : ("gdpr" as const);
    const region = { country: "US", region: "CA" };
    expect(
      createConsent({ categories: [], region, resolveRegulation }).regulation,
    ).toBe("ccpa");
    expect(
      createConsent({
        categories: [],
        region: { country: "US", region: "CA" },
        resolveRegulation: regulationFor,
      }).regulation,
    ).toBe("ccpa");
  });

  it("warns in development and falls back when region has no resolver", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      createConsent({
        categories: [],
        region: { country: "US", region: "CA" },
        fallbackRegulation: "none",
      }).regulation,
    ).toBe("none");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("without resolveRegulation"),
    );
  });

  it("passes the injectable current time to the regulation resolver", () => {
    const resolveRegulation = vi.fn(() => "none" as const);
    const region = { country: "US", region: "OK" };
    createConsent({ categories: [], region, resolveRegulation, now: 123 });
    expect(resolveRegulation).toHaveBeenCalledWith(region, 123);
  });

  it("applies GPC once and preserves explicit decisions outside sale/share", () => {
    const onConsent = vi.fn();
    const initial = state();
    initial.categories = {
      necessary: true,
      analytics: true,
      advertising: true,
    };
    const runtime = createConsent({
      categories: ["analytics", "advertising"],
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
      gpc: true,
      initial,
      onConsent,
    });
    expect(runtime.get()).toMatchObject({
      action: "gpc_auto",
      gpc: true,
      categories: { analytics: true, advertising: false },
    });
    expect(onConsent).toHaveBeenCalledOnce();
    runtime.acceptAll();
    expect(runtime.get().categories.advertising).toBe(false);
    const restored = createConsent({
      categories: ["advertising"],
      region: runtime.region,
      regulation: "ccpa",
      gpc: true,
      initial: runtime.get(),
      onConsent,
    });
    expect(restored.get().categories.advertising).toBe(false);
    expect(onConsent).toHaveBeenCalledTimes(2);
  });
  it("supports decisions while keeping necessary enabled", () => {
    const listener = vi.fn();
    const runtime = createConsent({
      categories: { necessary: false, analytics: false, ads: true },
      language: "fr",
    });
    runtime.subscribe(listener);

    expect(runtime.region).toBeNull();
    expect(runtime.regulation).toBe("gdpr");
    expect(runtime.language).toBe("fr");
    expect(runtime.set({ necessary: false, analytics: true }).action).toBe(
      "custom",
    );
    expect(runtime.has("necessary")).toBe(true);
    expect(runtime.has("analytics")).toBe(true);
    expect(runtime.rejectAll().categories).toEqual({
      necessary: true,
      analytics: false,
      ads: false,
    });
    expect(runtime.acceptAll().categories).toEqual({
      necessary: true,
      analytics: true,
      ads: true,
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("reports each decision without the storage schema field", () => {
    const onConsent = vi.fn();
    const runtime = createConsent({ categories: ["analytics"], onConsent });
    runtime.acceptAll();
    runtime.rejectAll();
    runtime.set({ analytics: true });
    expect(onConsent.mock.calls.map(([record]) => record.action)).toEqual([
      "accept_all",
      "reject_all",
      "custom",
    ]);
    expect(onConsent.mock.calls[0]?.[0]).toEqual({
      consentId: runtime.get().consentId,
      ts: expect.any(String),
      categories: { necessary: true, analytics: true },
      services: {},
      action: "accept_all",
      region: null,
      regulation: "gdpr",
      gpc: false,
    });
    expect(onConsent.mock.calls[0]?.[0]).not.toHaveProperty("schemaVersion");
  });

  it("is SSR-safe and creates UUID v4 identifiers", () => {
    const first = createConsent({ categories: {} });
    const second = createConsent({ categories: {} });
    expect(first.get().consentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.get().consentId).not.toBe(first.get().consentId);
    expect(() => first.acceptAll()).not.toThrow();
  });

  it("uses the RFC 4122 v4 getRandomValues fallback", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
    });
    expect(createConsent({ categories: {} }).get().consentId).toBe(
      "ffffffff-ffff-4fff-bfff-ffffffffffff",
    );
  });

  it.each(["example.com; Secure", "example .com", "example.com\u0001"])(
    "rejects unsafe cookie domain %j",
    (domain) =>
      expect(() =>
        createConsent({ categories: {}, cookie: { domain } }),
      ).toThrow(/Invalid cookie\.domain/),
  );

  it.each(["example.com", ".example.com"])(
    "accepts cookie domain %s",
    (domain) =>
      expect(() =>
        createConsent({ categories: {}, cookie: { domain } }),
      ).not.toThrow(),
  );

  it("returns isolated frozen snapshots to callers and subscribers", () => {
    const runtime = createConsent({
      categories: ["analytics"],
      services: [{ id: "metrics", category: "analytics" }],
    });
    const initial = runtime.get();
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.categories)).toBe(true);
    expect(() => {
      initial.categories.analytics = true;
    }).toThrow();
    expect(runtime.has("analytics")).toBe(false);

    const listener = vi.fn();
    runtime.subscribe(listener);
    runtime.set({ services: { metrics: true } });
    const notified = listener.mock.calls[0]?.[0] as ConsentState;
    expect(Object.isFrozen(notified)).toBe(true);
    expect(Object.isFrozen(notified.categories)).toBe(true);
    expect(Object.isFrozen(notified.services)).toBe(true);
    expect(() => {
      if (notified.services) notified.services.metrics = false;
    }).toThrow();
    expect(runtime.get().services).toEqual({ metrics: true });
    expect(runtime.get()).toBe(notified);
  });

  it("accepts a validated server initial state", () => {
    const initial = state();
    const runtime = createConsent({
      categories: { analytics: true, ads: false },
      initial,
    });
    expect(runtime.get().consentId).toBe(initial.consentId);
    expect(runtime.get().categories).toEqual({
      necessary: true,
      analytics: false,
      ads: false,
    });
  });

  it("resolves service consent from its category and explicit decisions", () => {
    const runtime = createConsent({
      categories: { analytics: false },
      services: [{ id: "analytics-demo", category: "analytics" }],
    });
    expect(runtime.hasService("analytics-demo")).toBe(false);
    runtime.set({ categories: { analytics: true } });
    expect(runtime.hasService("analytics-demo")).toBe(true);
    runtime.set({ services: { "analytics-demo": false } });
    expect(runtime.hasService("analytics-demo")).toBe(false);
  });

  it.each([
    ["gdpr", false, { session: true, metrics: false, ads: false }],
    ["ccpa", false, { session: true, metrics: true, ads: true }],
    ["ccpa", true, { session: true, metrics: true, ads: false }],
  ] as const)(
    "exposes effective service defaults before a decision in %s with GPC %s",
    (regulation, gpc, expected) => {
      const runtime = createConsent({
        categories: ["analytics", "marketing"],
        services: [
          { id: "session", category: "necessary" },
          { id: "metrics", category: "analytics" },
          { id: "ads", category: "marketing" },
        ],
        regulation,
        gpc,
      });
      expect(runtime.get().services).toEqual(expected);
      for (const [id, enabled] of Object.entries(expected)) {
        expect(runtime.hasService(id)).toBe(enabled);
      }
      expect(Object.isFrozen(runtime.get().services)).toBe(true);
    },
  );

  it("includes an empty services object without configured vendors", () => {
    const runtime = createConsent({ categories: [] });
    expect(runtime.get().services).toEqual({});
    expect(runtime.rejectAll().services).toEqual({});
  });

  it("fills missing services from legacy state without making defaults explicit overrides", () => {
    const records: unknown[] = [];
    const runtime = createConsent({
      categories: ["analytics"],
      services: [
        { id: "metrics", category: "analytics" },
        { id: "heatmap", category: "analytics" },
      ],
      initial: { ...state(), services: { heatmap: false, removed: true } },
      onConsent: (record) => records.push(record),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);
    expect(runtime.get().services).toEqual({ metrics: false, heatmap: false });
    runtime.set({ categories: { analytics: true } });
    expect(runtime.get().services).toEqual({ metrics: true, heatmap: false });
    expect(listener.mock.calls[0]?.[0].services).toEqual({
      metrics: true,
      heatmap: false,
    });
    expect(records[0]).toMatchObject({
      services: { metrics: true, heatmap: false },
    });
    runtime.set({ categories: { analytics: false } });
    expect(runtime.get().services).toEqual({ metrics: false, heatmap: false });
    runtime.set({ services: { metrics: true } });
    expect(runtime.get().services).toEqual({ metrics: true, heatmap: false });
  });

  it("decodes old v1 cookies with non-UUID ids and no service decisions", () => {
    const encoded = encodeConsentCookie(state());
    expect(decodeConsentCookie(encoded)).toEqual(state());
    expect(decodeConsentCookie(encoded)?.services).toBeUndefined();
  });
});

describe("VERSION", () => {
  it("exposes the package version", () => expect(VERSION).toBe("0.0.0"));
});
