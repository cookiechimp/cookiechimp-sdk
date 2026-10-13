// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEndpointLog,
  type EndpointLogOptions,
  logConsent,
  toEndpointRecord,
} from "./endpoint";
import { type ConsentRecord, createConsent } from "./index";

const T0 = Date.parse("2026-10-13T12:00:00Z");
const consent = (patch: Partial<ConsentRecord> = {}): ConsentRecord => ({
  consentId: "c0nsentIdAbcdefgh123",
  ts: "2026-10-13T12:00:00.000Z",
  categories: { necessary: true, analytics: true, marketing: false },
  services: { ga4: true, "meta-pixel": false },
  action: "custom",
  regulation: "gdpr",
  gpc: false,
  ...patch,
});
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}
type Call = [RequestInfo | URL, RequestInit | undefined];
const ok = (body = "") => vi.fn(async () => new Response(body));
const make = (options: Partial<EndpointLogOptions> = {}) =>
  createEndpointLog({
    endpoint: "/api/consent",
    storage: memoryStorage(),
    now: () => T0,
    random: () => 1,
    // Never reach the real network, even from a timer that outlives its test.
    fetch: async () => {
      throw new TypeError("offline");
    },
    ...options,
  });
const sent = (call: Call | undefined) =>
  JSON.parse(String(call?.[1]?.body)) as {
    schemaVersion: number;
    records: Record<string, unknown>[];
  };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: reset between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
});

describe("toEndpointRecord", () => {
  it("builds exactly the documented fields", () => {
    const record = toEndpointRecord(consent(), {
      url: "https://shop.example",
      language: "de",
    });
    expect(record).toEqual({
      id: "c0nsentIdAbcdefgh123:2026-10-13T12:00:00.000Z",
      consentId: "c0nsentIdAbcdefgh123",
      ts: "2026-10-13T12:00:00.000Z",
      action: "custom",
      categories: { necessary: true, analytics: true, marketing: false },
      services: { ga4: true, "meta-pixel": false },
      regulation: "gdpr",
      gpc: false,
      language: "de",
      url: "https://shop.example",
    });
  });

  it("omits optional fields and never adds identifiers", () => {
    const record = toEndpointRecord(
      consent({ services: undefined, regulation: undefined, gpc: true }),
      { url: "https://shop.example", language: "x".repeat(17) },
    );
    expect(Object.keys(record).sort()).toEqual(
      ["action", "categories", "consentId", "gpc", "id", "ts", "url"].sort(),
    );
    expect(record.gpc).toBe(true);
  });
});

describe("endpoint validation", () => {
  const bad = [
    ["protocol-relative path", "//evil.example/collect"],
    ["backslash path", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["data URL", "data:text/plain,x"],
    ["plain http host", "http://collector.example/consent"],
    ["credentials", "https://user:pass@collector.example/consent"],
    ["hash", "https://collector.example/consent#x"],
    ["relative without slash", "api/consent"],
    ["empty", ""],
  ] as const;

  it.each(bad)("throws in development for a %s", (_name, endpoint) => {
    expect(() => make({ endpoint })).toThrow(/CookieChimp endpoint log/);
  });

  it.each(bad)("is a no-op in production for a %s", async (_name, endpoint) => {
    vi.stubEnv("NODE_ENV", "production");
    const fetch = ok();
    const log = make({ endpoint, fetch });
    log.record(consent());
    await log.flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(log.pending()).toBe(0);
  });

  it("treats a missing process as production, so localhost http is refused", async () => {
    vi.stubGlobal("process", undefined);
    const fetch = ok();
    const log = make({ endpoint: "http://localhost:3000/consent", fetch });
    log.record(consent());
    await log.flush();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts a same-origin path in production on the page's own protocol", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetch = ok();
    make({ fetch }).record(consent());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it("resolves a same-origin path and accepts an https URL with a query", async () => {
    const fetch = ok();
    make({ fetch }).record(consent());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(String((fetch.mock.calls[0] as unknown as Call)[0])).toBe(
      `${window.location.origin}/api/consent`,
    );
    const other = ok();
    make({
      endpoint: "https://collector.example/consent?site=shop",
      fetch: other,
    }).record(consent());
    await vi.waitFor(() => expect(other).toHaveBeenCalledOnce());
    expect(String((other.mock.calls[0] as unknown as Call)[0])).toBe(
      "https://collector.example/consent?site=shop",
    );
  });
});

describe("delivery", () => {
  it("POSTs JSON without cookies or redirects and empties the queue on any 2xx", async () => {
    const fetch = ok("<html>ok</html>");
    const log = make({ fetch });
    log.record(consent(), "fr");
    expect(await log.flush()).toBe(0);
    const [, init] = fetch.mock.calls[0] as unknown as Call;
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      keepalive: true,
      redirect: "error",
      headers: { "Content-Type": "application/json" },
    });
    const payload = sent(fetch.mock.calls[0] as unknown as Call);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.records[0]).toMatchObject({
      id: "c0nsentIdAbcdefgh123:2026-10-13T12:00:00.000Z",
      language: "fr",
      url: window.location.origin,
    });
  });

  it("only removes ids listed in an accepted array and ignores hostile entries", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            accepted: [
              "c0nsentIdAbcdefgh123:2026-10-13T12:00:00.000Z",
              { id: "x" },
              7,
            ],
            __proto__: { polluted: true },
          }),
        ),
    );
    const log = make({ fetch });
    log.record(consent());
    log.record(consent({ ts: "2026-10-13T12:00:01.000Z" }));
    await log.flush();
    expect(log.pending()).toBe(1);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("keeps records on 4xx, 5xx and network errors and retries with backoff", async () => {
    vi.useFakeTimers({ now: T0 });
    const responses = [
      () => Promise.reject(new TypeError("offline")),
      () => Promise.resolve(new Response("", { status: 400 })),
    ];
    const fetch = vi.fn(async () =>
      responses.length
        ? (responses.shift() as () => Promise<Response>)()
        : new Response(""),
    );
    const log = make({ fetch, now: Date.now, baseDelayMs: 1000 });
    log.record(consent());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log.pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(log.pending()).toBe(0);
    log.destroy();
  });

  it("persists per endpoint so two destinations never share a queue", () => {
    const storage = memoryStorage();
    make({ storage }).record(consent());
    make({ storage, endpoint: "https://collector.example/c" }).record(
      consent(),
    );
    expect([...storage.data.keys()].sort()).toEqual([
      `cc_consent_queue:@${window.location.origin}/api/consent`,
      "cc_consent_queue:@https://collector.example/c",
    ]);
    expect(make({ storage }).pending()).toBe(1);
  });

  it("ignores a tampered stored queue", () => {
    const key = `cc_consent_queue:@${window.location.origin}/api/consent`;
    for (const raw of ["{", '{"a":1}', '[{"record":null}]', '[1,"x"]']) {
      const log = make({ storage: memoryStorage({ [key]: raw }) });
      expect(log.pending()).toBe(0);
      log.destroy();
    }
  });

  it("sends a cookie-less text/plain keepalive POST when the page is hidden", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      fetch.mock.calls.length === 1
        ? new Response("", { status: 503 })
        : new Response(""),
    );
    const log = make({ fetch, baseDelayMs: 60000 });
    log.record(consent());
    await log.flush();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(log.pending()).toBe(0));
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    log.destroy();
  });
});

describe("logConsent", () => {
  it("keeps the local cookie when the self-hosted POST fails", async () => {
    const log = make();
    const runtime = createConsent({
      categories: ["analytics"],
      fallbackRegulation: "gdpr",
    });
    const stop = logConsent(runtime, log);
    runtime.rejectAll();
    expect(runtime.has("analytics")).toBe(false);
    expect(document.cookie).toContain("cc_consent=");
    expect(log.pending()).toBe(1);
    await log.flush();
    expect(log.pending()).toBe(1);
    stop();
    log.destroy();
  });
});
