import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSync,
  type DashboardConfig,
  parseDashboardConfig,
  type SyncOptions,
} from "./sync";

const KEY = "cc_pk_test12345";
const dashboard = (version: string, label = "Dashboard analytics") => ({
  schemaVersion: 1,
  configVersion: version,
  etag: `"${version}"`,
  categories: [{ id: "analytics", label }],
  services: [],
  copy: { title: "Hi" },
  translations: {},
  regions: {},
  theme: {},
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
const cachedStorage = (config: object & { configVersion: string }) =>
  memoryStorage({
    "cc_config:proj_1": config.configVersion,
    [`cc_config:proj_1:${config.configVersion}`]: JSON.stringify(config),
  });
const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        init.status === 304
          ? null
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
        {
          status: 200,
          ...init,
        },
      ),
  );
const make = (options: Partial<SyncOptions> = {}) =>
  createSync({
    projectId: "proj_1",
    publishableKey: KEY,
    defaults: { categories: [{ id: "analytics", label: "Local analytics" }] },
    storage: memoryStorage(),
    revalidate: false,
    ...options,
  });
const label = (state: ReturnType<ReturnType<typeof make>["get"]>) =>
  state.config.categories.find((category) => category.id === "analytics")
    ?.label;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseDashboardConfig", () => {
  it("rejects malformed payloads and unknown schema majors", () => {
    for (const value of [
      null,
      [],
      "x",
      { schemaVersion: 2, configVersion: "1" },
      { schemaVersion: 1 },
      { schemaVersion: 1, configVersion: 5 },
      { schemaVersion: "1", configVersion: "1" },
    ])
      expect(parseDashboardConfig(value)).toBeUndefined();
  });

  it("keeps only known, well-typed fields", () => {
    const parsed = parseDashboardConfig({
      ...dashboard("1"),
      extra: true,
      categories: [
        { id: "analytics", label: 5, required: "yes", evil: 1 },
        { id: "x".repeat(65) },
        { label: "no id" },
        "ads",
      ],
      services: [
        { id: "a", category: "analytics", scripts: ["ok", 1, {}], run: "x" },
        { id: "b" },
      ],
      copy: [],
    }) as DashboardConfig;
    expect(parsed.categories).toEqual([{ id: "analytics" }]);
    expect(parsed.services).toEqual([
      { id: "a", category: "analytics", scripts: ["ok"] },
    ]);
    expect(parsed.copy).toEqual({});
    expect(parsed).not.toHaveProperty("extra");
  });
});

describe("createSync guards", () => {
  const bad: [string, Partial<SyncOptions>][] = [
    ["projectId", { projectId: "../admin" }],
    ["secret key", { publishableKey: "cc_sk_live12345678" }],
    ["publishable key", { publishableKey: "pk_bad" }],
    ["http origin", { apiBase: "http://evil.test" }],
    ["credentials in origin", { apiBase: "https://u:p@api.test" }],
    ["query in origin", { apiBase: "https://api.test/?x=1" }],
    ["unparsable origin", { apiBase: "not a url" }],
  ];

  it.each(bad)("throws in development for a bad %s", (_name, options) => {
    expect(() => make(options)).toThrow(/CookieChimp sync/);
  });

  it.each(bad)("fails closed in production for a bad %s", (_name, options) => {
    vi.stubEnv("NODE_ENV", "production");
    const fetch = respond(dashboard("1"));
    const sync = make({ ...options, fetch, revalidate: true });
    expect(sync.get()).toMatchObject({ status: "disabled", source: "local" });
    return sync.revalidate().then(() => expect(fetch).not.toHaveBeenCalled());
  });

  it("treats a missing process as production", async () => {
    vi.stubGlobal("process", undefined);
    const fetch = respond(dashboard("1"));
    const sync = make({ apiBase: "http://localhost:4000", fetch });
    expect(sync.get().status).toBe("disabled");
    await sync.revalidate();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows a localhost http origin only in development", async () => {
    const fetch = respond(dashboard("1"));
    await make({ apiBase: "http://localhost:4000/", fetch }).revalidate();
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "http://localhost:4000/projects/proj_1/config",
    );
  });
});

describe("createSync fetch and cache", () => {
  it("renders local config synchronously and fetches only in idle time", async () => {
    vi.useFakeTimers();
    const fetch = respond(dashboard("1"));
    const sync = make({ fetch, revalidate: true });
    expect(sync.get()).toMatchObject({ source: "local", status: "idle" });
    expect(label(sync.get())).toBe("Local analytics");
    expect(fetch).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledOnce();
    expect(label(sync.get())).toBe("Dashboard analytics");
  });

  it("sends the key, etag and encoded query, and omits credentials", async () => {
    const fetch = respond("", { status: 304 });
    const sync = make({
      fetch,
      storage: cachedStorage(dashboard("3")),
      locale: "fr",
      region: "US-CA&x=1",
    });
    expect(sync.get().source).toBe("cache");
    await sync.revalidate();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://api.cookiechimp.com/sdk/v1/projects/proj_1/config?locale=fr&region=US-CA%26x%3D1",
    );
    expect(init).toMatchObject({
      credentials: "omit",
      redirect: "error",
      headers: { Authorization: `Bearer ${KEY}`, "If-None-Match": '"3"' },
    });
    expect(sync.get()).toMatchObject({ source: "dashboard", status: "ready" });
  });

  it("stores the new version and removes the previous one", async () => {
    const storage = cachedStorage(dashboard("1"));
    await make({ storage, fetch: respond(dashboard("2")) }).revalidate();
    expect(storage.data.get("cc_config:proj_1")).toBe("2");
    expect(storage.data.has("cc_config:proj_1:1")).toBe(false);
    const next = make({ storage });
    expect(next.get().source).toBe("cache");
    expect(next.get().dashboard?.configVersion).toBe("2");
  });

  it("reports category changes unless reprompting is disabled", async () => {
    const changed = make({
      storage: cachedStorage(dashboard("1")),
      fetch: respond(dashboard("2", "Renamed")),
    });
    expect((await changed.revalidate()).categoriesChanged).toBe(true);
    const same = make({
      storage: cachedStorage(dashboard("1")),
      fetch: respond(dashboard("2")),
    });
    expect((await same.revalidate()).categoriesChanged).toBe(false);
    const off = make({
      reprompt: false,
      storage: cachedStorage(dashboard("1")),
      fetch: respond(dashboard("2", "Renamed")),
    });
    expect((await off.revalidate()).categoriesChanged).toBe(false);
  });

  it("applies code override over dashboard over code defaults", async () => {
    const sync = make({
      defaults: {
        categories: [
          { id: "analytics", label: "Local", description: "Local text" },
          { id: "ads", label: "Local ads" },
        ],
      },
      override: { categories: [{ id: "ads", label: "Override ads" }] },
      fetch: respond({
        ...dashboard("1"),
        categories: [
          { id: "analytics", label: "Dash" },
          { id: "ads", label: "Dash ads" },
        ],
      }),
    });
    const { config } = await sync.revalidate();
    expect(config.categories.slice(1)).toMatchObject([
      { id: "analytics", label: "Dash", description: "Local text" },
      { id: "ads", label: "Override ads" },
    ]);
  });

  it("deduplicates concurrent revalidations and notifies subscribers", async () => {
    const fetch = respond(dashboard("1"));
    const sync = make({ fetch });
    const seen: string[] = [];
    sync.subscribe((state) => seen.push(state.status));
    await Promise.all([sync.revalidate(), sync.revalidate()]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(seen).toEqual(["loading", "ready"]);
  });
});

describe("createSync failure handling", () => {
  const hostile: [string, ReturnType<typeof respond>][] = [
    ["a server error", respond("", { status: 500 })],
    ["invalid JSON", respond("{not json")],
    ["a wrong schema", respond({ ...dashboard("9"), schemaVersion: 2 })],
    ["an oversized body", respond(" ".repeat(524289))],
    [
      "a config that fails normalisation",
      respond({
        ...dashboard("9"),
        services: [{ id: "s", category: "missing" }],
      }),
    ],
    ["a 304 without a cache", respond("", { status: 304 })],
  ];

  it.each(hostile)("keeps the cached config on %s", async (_name, fetch) => {
    const storage = cachedStorage(dashboard("1", "Cached"));
    const sync = make({ storage, fetch });
    const state = await sync.revalidate();
    expect(label(state)).toBe("Cached");
    expect(storage.data.get("cc_config:proj_1")).toBe("1");
    if (_name !== "a 304 without a cache") expect(state.status).toBe("error");
  });

  it.each(hostile)("keeps the local config on %s", async (_name, fetch) => {
    const state = await make({ fetch }).revalidate();
    expect(state).toMatchObject({ status: "error", source: "local" });
    expect(label(state)).toBe("Local analytics");
  });

  it("falls back when offline", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const state = await make({
      fetch,
      storage: cachedStorage(dashboard("1", "Cached")),
    }).revalidate();
    expect(state).toMatchObject({ status: "error", error: "network error" });
    expect(label(state)).toBe("Cached");
  });

  it("aborts a hanging request after the timeout", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    const pending = make({ fetch, timeoutMs: 100 }).revalidate();
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ status: "error", error: "timeout" });
  });

  it("ignores tampered, mismatched or unreadable cache entries", () => {
    const broken = [
      memoryStorage({ "cc_config:proj_1": "1", "cc_config:proj_1:1": "{bad" }),
      memoryStorage({
        "cc_config:proj_1": "2",
        "cc_config:proj_1:2": JSON.stringify(dashboard("1")),
      }),
      {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {},
        removeItem: () => {},
      },
    ];
    for (const storage of broken)
      expect(make({ storage }).get().source).toBe("local");
    expect(make({ storage: null }).get().source).toBe("local");
  });

  it("survives a storage that refuses writes", async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const state = await make({
      storage,
      fetch: respond(dashboard("1")),
    }).revalidate();
    expect(state.status).toBe("ready");
  });

  it("stops after destroy and ignores late responses", async () => {
    let resolve: (response: Response) => void = () => {};
    const fetch = vi.fn(
      () => new Promise<Response>((done) => (resolve = done)),
    );
    const sync = make({ fetch });
    const listener = vi.fn();
    sync.subscribe(listener);
    const pending = sync.revalidate();
    listener.mockClear();
    sync.destroy();
    resolve(new Response(JSON.stringify(dashboard("1"))));
    await pending;
    expect(listener).not.toHaveBeenCalled();
    await sync.revalidate();
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("prototype pollution", () => {
  it("drops __proto__, constructor and prototype keys from remote config", async () => {
    const body = `{"schemaVersion":1,"configVersion":"1","__proto__":{"polluted":1},"categories":[{"id":"analytics","__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}],"copy":{"__proto__":{"polluted":1}},"services":[]}`;
    const storage = memoryStorage();
    const state = await make({ storage, fetch: respond(body) }).revalidate();
    expect(state.status).toBe("ready");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(state.dashboard?.copy)).toBe(Object.prototype);
    expect(storage.data.get("cc_config:proj_1:1")).not.toContain("__proto__");
  });

  it("does not pollute when a category or service id is __proto__", async () => {
    const state = await make({
      fetch: respond({
        ...dashboard("1"),
        categories: [{ id: "__proto__", label: "x" }],
        services: [{ id: "__proto__", category: "analytics" }],
      }),
    }).revalidate();
    expect(({} as Record<string, unknown>).label).toBeUndefined();
    expect(({} as Record<string, unknown>).category).toBeUndefined();
    expect(["ready", "error"]).toContain(state.status);
  });
});
