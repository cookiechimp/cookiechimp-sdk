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
  it("supports decisions while keeping necessary enabled", () => {
    const listener = vi.fn();
    const runtime = createConsent({
      categories: { necessary: false, analytics: false, ads: true },
      language: "fr",
    });
    runtime.subscribe(listener);

    expect(runtime.region).toBeNull();
    expect(runtime.regulation).toBe("none");
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
      action: "accept_all",
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
    expect(runtime.get()).not.toBe(notified);
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

  it("decodes old v1 cookies with non-UUID ids and no service decisions", () => {
    const encoded = encodeConsentCookie(state());
    expect(decodeConsentCookie(encoded)).toEqual(state());
    expect(decodeConsentCookie(encoded)?.services).toBeUndefined();
  });
});

describe("VERSION", () => {
  it("exposes the package version", () => expect(VERSION).toBe("0.0.0"));
});
