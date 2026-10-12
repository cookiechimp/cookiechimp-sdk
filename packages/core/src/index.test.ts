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

afterEach(() => vi.restoreAllMocks());

describe("cookie codec", () => {
  it("round trips compact, Unicode category data", () => {
    const input = state();
    input.categories.métrique = true;
    const encoded = encodeConsentCookie(input);
    expect(encoded.startsWith("v1.")).toBe(true);
    expect(encoded.length).toBeLessThan(500);
    expect(decodeConsentCookie(encoded)).toEqual(input);
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

  it("is SSR-safe and creates unique URL-safe identifiers", () => {
    const first = createConsent({ categories: {} });
    const second = createConsent({ categories: {} });
    expect(first.get().consentId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second.get().consentId).not.toBe(first.get().consentId);
    expect(() => first.acceptAll()).not.toThrow();
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
});

describe("VERSION", () => {
  it("exposes the package version", () => expect(VERSION).toBe("0.0.0"));
});
