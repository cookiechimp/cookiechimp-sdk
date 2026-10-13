// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ConsentLogOptions,
  createConsentLog,
  logConsent,
  toPlatformConsent,
} from "./consent-log";
import { type ConsentRecord, createConsent } from "./index";

const ACCOUNT = "acctREDACTED";
const ENDPOINT = `https://cookiechimp.com/api/v1/mobile-sdk/sync/${ACCOUNT}`;
const T0 = Date.parse("2026-10-13T12:00:00Z");
const consent = (patch: Partial<ConsentRecord> = {}): ConsentRecord => ({
  consentId: "c0nsentIdAbcdefgh123",
  ts: "2026-10-13T12:00:00.000Z",
  categories: { necessary: true, analytics: true, marketing: false },
  services: { "google-analytics": true, "meta-pixel": false },
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
const okSync = () =>
  vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { consents } = JSON.parse(String(init?.body)) as {
      consents: { client_id: string }[];
    };
    return new Response(
      JSON.stringify({
        synced_count: consents.length,
        failed_count: 0,
        synced: consents.map(({ client_id }) => ({
          client_id,
          server_id: "v1",
        })),
        failed: [],
      }),
    );
  });
let clock = T0;
const make = (options: Partial<ConsentLogOptions> = {}) =>
  createConsentLog({
    projectId: ACCOUNT,
    storage: memoryStorage(),
    now: () => clock,
    random: () => 1,
    ...options,
  });
const body = (call: Call | undefined) =>
  JSON.parse(String(call?.[1]?.body)) as {
    consents: Record<string, unknown>[];
  };

beforeEach(() => {
  // Never reach the real network from a test that relies on the default fetch.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  clock = T0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("toPlatformConsent", () => {
  it("builds exactly the documented platform batch fields", () => {
    const record = toPlatformConsent(consent(), {
      url: "https://shop.example",
      bannerId: "bnrEU1",
      language: "de",
      serviceCategories: {
        "google-analytics": "analytics",
        "meta-pixel": "marketing",
      },
    });
    expect(record).toEqual({
      client_id: "c0nsentIdAbcdefgh123:2026-10-13T12:00:00.000Z",
      uuid: "c0nsentIdAbcdefgh123",
      platform: "web",
      visitor_action: "consent",
      url: "https://shop.example",
      gpc_preference: false,
      language_code: "de",
      consent_banner_hashid: "bnrEU1",
      created_at: "2026-10-13T12:00:00.000Z",
      user_preferences: {
        acceptType: "custom",
        action: "custom",
        acceptedCategories: ["necessary", "analytics"],
        rejectedCategories: ["marketing"],
        acceptedServices: { analytics: ["google-analytics"] },
        rejectedServices: { marketing: ["meta-pixel"] },
        regulation: "gdpr",
      },
    });
  });

  it("maps actions to CookieConsent accept types and never adds PII fields", () => {
    const url = "https://shop.example";
    expect(
      toPlatformConsent(consent({ action: "accept_all" }), { url })
        .user_preferences.acceptType,
    ).toBe("all");
    expect(
      toPlatformConsent(consent({ action: "reject_all" }), { url })
        .user_preferences.acceptType,
    ).toBe("necessary");
    const gpc = toPlatformConsent(
      consent({ action: "gpc_auto", gpc: true, services: undefined }),
      { url },
    );
    expect(gpc.user_preferences).toMatchObject({
      acceptType: "custom",
      action: "gpc_auto",
      acceptedServices: {},
    });
    expect(gpc.gpc_preference).toBe(true);
    for (const field of [
      "device_identifier",
      "visitor_user_id",
      "ip_address",
      "user_agent",
      "ip_region",
    ])
      expect(gpc).not.toHaveProperty(field);
  });

  it("groups unknown services under other and ignores inherited category lookups", () => {
    const record = toPlatformConsent(
      consent({ services: { constructor: true, toString: false } }),
      {
        url: "https://shop.example",
        serviceCategories: {},
      },
    );
    expect(record.user_preferences.acceptedServices).toEqual({
      other: ["constructor"],
    });
    expect(record.user_preferences.rejectedServices).toEqual({
      other: ["toString"],
    });
    expect(({} as Record<string, unknown>).other).toBeUndefined();
  });
});

describe("guards", () => {
  const bad: [string, Partial<ConsentLogOptions>][] = [
    ["projectId", { projectId: "../x" }],
    ["http origin", { apiBase: "http://evil.test" }],
    ["credentials", { apiBase: "https://u:p@api.test" }],
    ["query", { apiBase: "https://api.test/?a=1" }],
  ];
  it.each(bad)("throws in development for a bad %s", (_name, options) => {
    expect(() => make(options)).toThrow(/CookieChimp consent log/);
  });
  it.each(bad)(
    "does nothing in production for a bad %s",
    async (_name, options) => {
      vi.stubEnv("NODE_ENV", "production");
      const fetch = okSync();
      const log = make({ ...options, fetch });
      log.record(consent());
      await log.flush();
      expect(fetch).not.toHaveBeenCalled();
      expect(log.pending()).toBe(0);
    },
  );
  it("treats a missing process as production", async () => {
    vi.stubGlobal("process", undefined);
    const fetch = okSync();
    const log = make({ apiBase: "http://localhost:3000", fetch });
    log.record(consent());
    await log.flush();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("delivery", () => {
  it("POSTs the batch without cookies, with keepalive, and empties the queue", async () => {
    const fetch = okSync();
    const storage = memoryStorage();
    const log = make({ fetch, storage });
    log.record(consent(), "en");
    await log.flush();
    const [url, init] = fetch.mock.calls[0] as Call;
    expect(String(url)).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      keepalive: true,
      redirect: "error",
      headers: { "Content-Type": "application/json" },
    });
    expect(body(fetch.mock.calls[0] as Call).consents[0]).toMatchObject({
      url: "http://localhost:3000",
      language_code: "en",
    });
    expect(log.pending()).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it("record is synchronous and never throws even when storage and fetch throw", () => {
    const log = make({
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
      },
      fetch: () => {
        throw new Error("boom");
      },
    });
    expect(() => log.record(consent())).not.toThrow();
    expect(log.pending()).toBe(1);
  });

  it("deduplicates the same decision", async () => {
    const fetch = okSync();
    const log = make({ fetch });
    log.record(consent());
    log.record(consent());
    await log.flush();
    expect(body(fetch.mock.calls[0] as Call).consents).toHaveLength(1);
  });

  it("keeps records on network errors, 5xx and 403 and retries with capped exponential backoff", async () => {
    vi.useFakeTimers({ now: T0 });
    const responses = [
      () => Promise.reject(new TypeError("offline")),
      () => Promise.resolve(new Response("", { status: 503 })),
      () =>
        Promise.resolve(
          new Response('{"error":"only mobile"}', { status: 403 }),
        ),
    ];
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      responses.length
        ? (responses.shift() as () => Promise<Response>)()
        : okSync()(url, init),
    );
    const log = make({
      fetch,
      now: Date.now,
      baseDelayMs: 1000,
      maxDelayMs: 3000,
    });
    log.record(consent());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(log.pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(log.pending()).toBe(0);
    log.destroy();
  });

  it("re-arms the retry when a timer fires before the record is due", async () => {
    vi.useFakeTimers({ now: T0 });
    let skew = 0;
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      fetch.mock.calls.length === 1
        ? new Response("", { status: 500 })
        : okSync()(url, init),
    );
    const log = make({
      fetch,
      now: () => Date.now() - skew,
      baseDelayMs: 1000,
    });
    log.record(consent());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    // The clock reads slightly behind the timer, so the first wake finds nothing due.
    skew = 5;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    skew = 0;
    await vi.advanceTimersByTimeAsync(10);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log.pending()).toBe(0);
    log.destroy();
  });

  it("aborts a hanging POST after the timeout and keeps the record", async () => {
    vi.useFakeTimers({ now: T0 });
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    const log = make({ fetch, now: Date.now, timeoutMs: 100 });
    log.record(consent());
    await vi.advanceTimersByTimeAsync(100);
    expect(log.pending()).toBe(1);
    log.destroy();
  });

  it("drops validation failures but retries batch-limit overflow", async () => {
    const a = consent();
    const b = consent({ ts: "2026-10-13T12:00:01.000Z" });
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            synced: [],
            failed: [
              {
                client_id: `${a.consentId}:${a.ts}`,
                errors: ["Uuid can't be blank"],
              },
              {
                client_id: `${b.consentId}:${b.ts}`,
                errors: ["Batch limit exceeded"],
              },
            ],
          }),
        ),
    );
    const log = make({ fetch });
    log.record(a);
    log.record(b);
    await log.flush();
    expect(log.pending()).toBe(1);
  });

  it("treats a hostile or unreadable 2xx body as accepted without resending", async () => {
    for (const reply of [
      "{not json",
      "null",
      '{"__proto__":{"polluted":1},"synced":"x"}',
      " ".repeat(70000),
    ]) {
      const fetch = vi.fn(async () => new Response(reply));
      const log = make({ fetch });
      log.record(consent());
      await log.flush();
      expect(log.pending()).toBe(0);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("only removes the client ids the server confirms", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            synced: [{ client_id: "someone-else" }],
            failed: [],
          }),
        ),
    );
    const log = make({ fetch });
    log.record(consent());
    await log.flush();
    expect(log.pending()).toBe(1);
  });
});

describe("queue", () => {
  it("persists across reloads and caps at maxQueue, dropping the oldest", async () => {
    const storage = memoryStorage();
    const fetch = vi.fn(async () => new Response("", { status: 500 }));
    const log = make({ storage, fetch, maxQueue: 3 });
    for (let i = 0; i < 5; i++)
      log.record(consent({ ts: `2026-10-13T12:00:0${i}.000Z` }));
    await log.flush();
    log.destroy();
    const restored = make({ storage, fetch: okSync() });
    expect(restored.pending()).toBe(3);
    const [first] = JSON.parse(
      storage.data.get(`cc_consent_queue:${ACCOUNT}`) ?? "[]",
    );
    expect(first.record.created_at).toBe("2026-10-13T12:00:02.000Z");
    restored.destroy();
  });

  it("drops records older than 30 days", () => {
    const storage = memoryStorage();
    const log = make({
      storage,
      fetch: vi.fn(async () => new Response("", { status: 500 })),
    });
    log.record(consent());
    log.destroy();
    clock = T0 + 31 * 86400000;
    expect(make({ storage }).pending()).toBe(0);
  });

  it("ignores a tampered stored queue", () => {
    for (const raw of [
      "{bad",
      '{"a":1}',
      '[{"record":null},{"attempts":"x"},1]',
    ])
      expect(
        make({
          storage: memoryStorage({ [`cc_consent_queue:${ACCOUNT}`]: raw }),
        }).pending(),
      ).toBe(0);
  });

  it("flushes immediately when the browser comes back online", async () => {
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("", { status: 500 }),
    );
    const log = make({ fetch });
    log.record(consent());
    await log.flush();
    fetch.mockImplementation(okSync());
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(log.pending()).toBe(0));
    log.destroy();
  });
});

describe("page hide", () => {
  it("sends a text/plain beacon with no cookies and clears the queue when accepted", async () => {
    const sendBeacon = vi.fn((_url: string, _data: Blob) => true);
    const log = make({
      fetch: vi.fn(async () => new Response("", { status: 500 })),
      sendBeacon,
    });
    log.record(consent());
    await log.flush();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    const [url, blob] = sendBeacon.mock.calls[0] ?? [];
    expect(url).toBe(ENDPOINT);
    expect(blob?.type).toBe("text/plain;charset=utf-8");
    expect(JSON.parse(await (blob as Blob).text()).consents).toHaveLength(1);
    expect(log.pending()).toBe(0);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    log.destroy();
  });

  it("keeps the queue when the beacon is refused", async () => {
    const log = make({
      fetch: vi.fn(async () => new Response("", { status: 500 })),
      sendBeacon: () => false,
    });
    log.record(consent());
    await log.flush();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(log.pending()).toBe(1);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    log.destroy();
  });
});

describe("logConsent", () => {
  it("records decisions only, and the local cookie is written even when the POST fails", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const log = make({ fetch });
    const runtime = createConsent({
      categories: ["analytics"],
      fallbackRegulation: "gdpr",
    });
    const stop = logConsent(runtime, log);
    expect(log.pending()).toBe(0);
    runtime.acceptAll();
    expect(runtime.has("analytics")).toBe(true);
    expect(document.cookie).toContain("cc_consent=");
    expect(log.pending()).toBe(1);
    stop();
    log.destroy();
  });
});
