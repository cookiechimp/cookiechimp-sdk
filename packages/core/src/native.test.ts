// Runs without a DOM, like React Native: no document, no cookies, and a
// `window` global that has no event methods.
import { afterEach, describe, expect, it, vi } from "vitest";

const ACCOUNT = "acctREDACTED";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const okSync = () =>
  vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { consents } = JSON.parse(String(init?.body)) as {
      consents: { client_id: string }[];
    };
    return new Response(
      JSON.stringify({
        synced: consents.map(({ client_id }) => ({ client_id })),
        failed: [],
      }),
    );
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("consent storage adapter", () => {
  it("persists to the adapter under the cookie name and restores from it", async () => {
    const { createConsent } = await import("./index");
    const storage = memoryStorage();
    const config = {
      categories: ["analytics", "marketing"],
      regulation: "gdpr" as const,
      storage,
      cookie: { name: "cc_app" },
    };
    const first = createConsent(config);
    expect(first.needsDecision).toBe(true);
    first.set({ analytics: true });
    expect(storage.data.get("cc_app")).toMatch(/^v1\./);

    const second = createConsent(config);
    expect(second.needsDecision).toBe(false);
    expect(second.has("analytics")).toBe(true);
    expect(second.has("marketing")).toBe(false);
    expect(second.get().consentId).toBe(first.get().consentId);
  });

  it("ignores stored consent older than cookie.maxAge", async () => {
    const { createConsent } = await import("./index");
    const storage = memoryStorage();
    const config = {
      categories: ["analytics"],
      regulation: "gdpr" as const,
      storage,
      cookie: { maxAge: 60 },
    };
    createConsent(config).acceptAll();
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      expect(createConsent(config).needsDecision).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats unreadable or throwing storage as no decision", async () => {
    const { createConsent } = await import("./index");
    const broken = {
      getItem: () => {
        throw new Error("locked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    const consent = createConsent({
      categories: ["analytics"],
      regulation: "gdpr",
      storage: broken,
    });
    expect(consent.needsDecision).toBe(true);
    expect(() => consent.acceptAll()).not.toThrow();
    expect(
      createConsent({
        categories: ["analytics"],
        regulation: "gdpr",
        storage: memoryStorage({ cc_consent: "garbage" }),
      }).needsDecision,
    ).toBe(true);
  });
});

describe("runtimes without Web Crypto or TextDecoder", () => {
  it("creates v4 ids and round trips Unicode consent", async () => {
    vi.stubGlobal("crypto", undefined);
    vi.stubGlobal("TextEncoder", undefined);
    vi.stubGlobal("TextDecoder", undefined);
    const { createConsent, decodeConsentCookie, encodeConsentCookie } =
      await import("./index");
    const consent = createConsent({
      categories: ["analytics"],
      regulation: "gdpr",
      storage: memoryStorage(),
    });
    const state = consent.acceptAll();
    expect(state.consentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const unicode = {
      ...state,
      categories: { ...state.categories, "statistik-übersicht-日本": true },
    };
    expect(decodeConsentCookie(encodeConsentCookie(unicode))).toMatchObject({
      categories: { "statistik-übersicht-日本": true },
    });
    // Invalid UTF-8 is rejected like a fatal TextDecoder.
    expect(decodeConsentCookie("v1._w")).toBeNull();
  });
});

describe("consent log in a native app", () => {
  it("does not need DOM events, tags the platform and retries on demand", async () => {
    vi.stubGlobal("window", {});
    const { createConsentLog } = await import("./consent-log");
    const { createConsent } = await import("./index");
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("", { status: 503 }),
    );
    const log = createConsentLog({
      projectId: ACCOUNT,
      platform: "ios",
      storage: memoryStorage(),
      fetch,
      baseDelayMs: 60_000,
    });
    const consent = createConsent({
      categories: ["analytics"],
      regulation: "gdpr",
      storage: memoryStorage(),
    });
    log.record(consent.acceptAll(), "en");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await log.flush();
    expect(log.pending()).toBe(1);

    fetch.mockImplementation(okSync());
    await log.retry();
    expect(log.pending()).toBe(0);
    const sent = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)) as {
      consents: Record<string, unknown>[];
    };
    expect(sent.consents[0]).toMatchObject({
      platform: "ios",
      url: "",
      language_code: "en",
    });
    expect(() => log.destroy()).not.toThrow();
  });

  it("falls back to web for unknown platforms", async () => {
    const { toPlatformConsent } = await import("./consent-log");
    const record = toPlatformConsent(
      {
        consentId: "c0nsentIdAbcdefgh123",
        ts: "2026-10-13T12:00:00.000Z",
        categories: { necessary: true },
        action: "accept_all",
      },
      { url: "", platform: "windows" as "web" },
    );
    expect(record.platform).toBe("web");
  });
});
