import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adaptPlatformConfig,
  createSync,
  type DashboardConfig,
  type SyncOptions,
  safeJson,
} from "./sync";

// Built from the platform offline bundle (MobileSdk::OfflineBundleBuilder,
// docs/mobile_sdk.md) with account, cookie and URLs redacted.
const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/platform-offline-bundle.json"),
  "utf8",
);
type Bundle = Record<string, unknown> & { cache_version: string };
const bundle = (patch: Record<string, unknown> = {}): Bundle => ({
  ...JSON.parse(FIXTURE),
  ...patch,
});
const ACCOUNT = "acctREDACTED";
const URL_ = `https://cookiechimp.com/api/v1/mobile-sdk/offline/${ACCOUNT}`;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}
const cachedStorage = (value: Bundle) =>
  memoryStorage({
    [`cc_config:${ACCOUNT}`]: value.cache_version,
    [`cc_config:${ACCOUNT}:${value.cache_version}`]: JSON.stringify(value),
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
        { status: 200, ...init },
      ),
  );
const sentHeaders = (fn: { mock: { calls: unknown[][] } }) =>
  ((fn.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<
    string,
    string
  >;
const make = (options: Partial<SyncOptions> = {}) =>
  createSync({
    projectId: ACCOUNT,
    defaults: { categories: [{ id: "analytics", label: "Local analytics" }] },
    storage: memoryStorage(),
    revalidate: false,
    ...options,
  });
const label = (state: {
  config: { categories: readonly { id: string; label?: string }[] };
}) =>
  state.config.categories.find((category) => category.id === "analytics")
    ?.label;
const renamed = (version: string, name: string) => {
  const value = bundle({ cache_version: version });
  const categories = value.categories as {
    slug: string;
    translations: Record<string, { name: string }>;
  }[];
  for (const category of categories)
    if (category.slug === "analytics")
      (category.translations.en as { name: string }).name = name;
  return value;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("adaptPlatformConfig with the platform offline bundle", () => {
  it("maps categories, services and cookies for the default banner", () => {
    const config = adaptPlatformConfig(bundle()) as DashboardConfig;
    expect(config).toMatchObject({
      schemaVersion: 1,
      configVersion: "a1b2c3d4",
      etag: '"a1b2c3d4"',
      revision: 4,
      accountId: ACCOUNT,
      bannerId: "bnrUS1",
      consentMode: "opt_out",
      language: "en",
      reconsentRequiredAt: "2026-06-01T00:00:00Z",
      cookie: { name: "cookiechimp_pref_REDACTED", expires_days: 182 },
    });
    expect(config.categories).toEqual([
      {
        id: "essential",
        required: true,
        default: true,
        label: "Essential",
        description: "Required for the site to function",
      },
      {
        id: "analytics",
        required: false,
        default: true,
        label: "Analytics",
        description: "Helps us understand usage",
      },
      {
        id: "marketing",
        required: false,
        default: true,
        label: "Marketing",
        description: "Personalised advertising",
      },
    ]);
    expect(config.services).toEqual([
      {
        id: "session-management",
        category: "essential",
        name: "Session Management",
        cookies: ["session_id"],
        default: true,
      },
      {
        id: "google-analytics",
        category: "analytics",
        name: "Google Analytics",
        cookies: ["_ga"],
        default: false,
      },
      {
        id: "meta-pixel",
        category: "marketing",
        name: "Meta Pixel",
        cookies: ["_fbp"],
        default: false,
      },
    ]);
    expect(config.serviceIds).toEqual({
      "session-management": "svcSESS1",
      "google-analytics": "svcGA4",
      "meta-pixel": "svcMETA1",
    });
    expect(config.copy).toMatchObject({
      consent_modal: { accept_btn: "Accept All" },
    });
    expect(config.theme).toMatchObject({ colors: { bg: "#ffffff" } });
    expect(config.integrations).toMatchObject({
      global_privacy_control: { enabled: true },
    });
  });

  it("selects the banner by region, then country, then default, and the language by locale", () => {
    const de = adaptPlatformConfig(bundle(), {
      region: "DE-BY",
      locale: "de-AT",
    }) as DashboardConfig;
    expect(de).toMatchObject({
      bannerId: "bnrEU1",
      consentMode: "opt_in",
      language: "de",
    });
    expect(de.categories[1]).toMatchObject({
      id: "analytics",
      label: "Statistik",
      default: false,
    });
    expect(de.services[1]?.name).toBe("Google Analyse");
    expect(de.copy).toMatchObject({
      consent_modal: { title: "Wir respektieren Ihre Privatsphäre" },
    });
    expect(adaptPlatformConfig(bundle(), { region: "us-ca" })?.bannerId).toBe(
      "bnrUS1",
    );
    expect(adaptPlatformConfig(bundle(), { region: "JP" })?.bannerId).toBe(
      "bnrUS1",
    );
    expect(
      adaptPlatformConfig(bundle(), { region: "FR", locale: "ja" })?.language,
    ).toBe("en");
  });

  it("does not resolve inherited keys as banners, regions or languages", () => {
    for (const region of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
    ])
      expect(
        adaptPlatformConfig(bundle(), { region, locale: "constructor" }),
      ).toMatchObject({ bannerId: "bnrUS1", language: "en" });
    expect(
      adaptPlatformConfig(
        bundle({ default_banner: "toString", country_banner_map: {} }),
      ),
    ).toBeUndefined();
  });

  it("rejects payloads that are malformed, for another account or a future schema", () => {
    for (const value of [
      null,
      [],
      "x",
      bundle({ cache_version: undefined }),
      bundle({ cache_version: 5 }),
      bundle({ account_hashid: undefined }),
      bundle({ schema_version: 2 }),
      bundle({ banners: {} }),
      bundle({ banners: [] }),
      bundle({ default_banner: "missing", country_banner_map: {} }),
    ])
      expect(adaptPlatformConfig(value)).toBeUndefined();
    expect(
      adaptPlatformConfig(bundle(), { projectId: "someoneElse" }),
    ).toBeUndefined();
    expect(adaptPlatformConfig(bundle({ schema_version: 1 }))).toBeDefined();
  });

  it("keeps only well-typed fields from hostile entries", () => {
    const config = adaptPlatformConfig(
      bundle({
        version: "4",
        categories: [
          {
            slug: "analytics",
            name: 5,
            required: "yes",
            services: [
              { name: {}, id: 1 },
              {
                name: "Ok Tool",
                id: 2,
                storage_items: [{ type: "cookie", name: 7 }, "x"],
              },
              { name: "ok tool" },
            ],
          },
          { slug: "x".repeat(200) },
          { name: "no slug" },
          "ads",
        ],
      }),
    ) as DashboardConfig;
    expect(config.revision).toBeUndefined();
    expect(config.categories).toEqual([
      { id: "analytics", required: false, default: true },
    ]);
    expect(config.services).toEqual([
      { id: "ok-tool", category: "analytics", name: "Ok Tool" },
    ]);
    expect(config.serviceIds).toEqual({ "ok-tool": "" });
  });
});

describe("safeJson", () => {
  it("drops prototype keys at every depth", () => {
    const value = safeJson(
      '{"__proto__":{"polluted":1},"a":{"constructor":{"prototype":{"polluted":1}},"b":[{"__proto__":{"polluted":1}}]}}',
    ) as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(value, "__proto__")).toBe(false);
    expect(JSON.stringify(value)).toBe('{"a":{"b":[{}]}}');
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

  it.each(bad)(
    "fails closed in production for a bad %s",
    async (_name, options) => {
      vi.stubEnv("NODE_ENV", "production");
      const fetch = respond(bundle());
      const sync = make({ ...options, fetch, revalidate: true });
      expect(sync.get()).toMatchObject({ status: "disabled", source: "local" });
      await sync.revalidate();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("treats a missing process as production", async () => {
    vi.stubGlobal("process", undefined);
    const fetch = respond(bundle());
    const sync = make({ apiBase: "http://localhost:4000", fetch });
    expect(sync.get().status).toBe("disabled");
    await sync.revalidate();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows a localhost http origin only in development", async () => {
    const fetch = respond(bundle());
    await make({ apiBase: "http://localhost:4000/", fetch }).revalidate();
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `http://localhost:4000/api/v1/mobile-sdk/offline/${ACCOUNT}`,
    );
  });
});

describe("createSync fetch and cache", () => {
  it("renders local config synchronously and fetches only in idle time", async () => {
    vi.useFakeTimers();
    const fetch = respond(renamed("v1", "Dashboard analytics"));
    const sync = make({ fetch, revalidate: true });
    expect(sync.get()).toMatchObject({ source: "local", status: "idle" });
    expect(label(sync.get())).toBe("Local analytics");
    expect(fetch).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledOnce();
    expect(label(sync.get())).toBe("Dashboard analytics");
  });

  it("revalidates even when the page never goes idle", async () => {
    vi.useFakeTimers();
    // A browser that is never idle only runs the callback at its timeout.
    vi.stubGlobal(
      "requestIdleCallback",
      (fn: () => void, options?: { timeout?: number }) =>
        options?.timeout ? setTimeout(fn, options.timeout) : 0,
    );
    try {
      const fetch = respond(bundle());
      const sync = createSync({
        projectId: ACCOUNT,
        storage: memoryStorage(),
        fetch,
      });
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      sync.destroy();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("calls the shared platform endpoint without cookies or a key by default", async () => {
    const fetch = respond(bundle());
    await make({ fetch }).revalidate();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(URL_);
    expect(init).toMatchObject({
      credentials: "omit",
      redirect: "error",
      headers: {},
    });
  });

  it("sends the publishable key and cache_version ETag, and a 304 keeps the cache", async () => {
    const fetch = respond("", { status: 304 });
    const sync = make({
      fetch,
      publishableKey: "cc_pk_test12345",
      storage: cachedStorage(bundle()),
    });
    expect(sync.get().source).toBe("cache");
    await sync.revalidate();
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer cc_pk_test12345",
        "If-None-Match": '"a1b2c3d4"',
      },
    });
    expect(sync.get()).toMatchObject({ source: "dashboard", status: "ready" });
  });

  it("sends a server-rendered etag when nothing is cached, and a 304 keeps state", async () => {
    const fetch = respond(null, { status: 304 });
    const sync = make({ fetch, etag: '"v-server"' });
    const state = await sync.revalidate();
    expect(sentHeaders(fetch)["If-None-Match"]).toBe('"v-server"');
    expect(state).toMatchObject({ status: "ready", source: "local" });
    expect(state.dashboard).toBeUndefined();
  });

  it("replaces a stale server etag with the newer config", async () => {
    const sync = make({
      fetch: respond(bundle({ cache_version: "v-new" })),
      etag: '"v-old"',
    });
    const state = await sync.revalidate();
    expect(state.source).toBe("dashboard");
    expect(state.dashboard?.configVersion).toBe("v-new");
  });

  it("prefers the cached etag and ignores an unprintable one", async () => {
    const cached = bundle({ cache_version: "v-cache" });
    const fetch = respond(null, { status: 304 });
    await make({
      fetch,
      storage: cachedStorage(cached),
      etag: '"v-server"',
    }).revalidate();
    const sent = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(sent["If-None-Match"]).not.toBe('"v-server"');
    const plain = respond(bundle());
    await make({ fetch: plain, etag: '"x"\r\nCookie: a=1' }).revalidate();
    expect(sentHeaders(plain)["If-None-Match"]).toBeUndefined();
  });

  it("re-adapts the cached bundle for the current region and locale", () => {
    const storage = cachedStorage(bundle());
    expect(make({ storage }).get().dashboard?.bannerId).toBe("bnrUS1");
    expect(
      make({ storage, region: "DE", locale: "de" }).get().dashboard,
    ).toMatchObject({ bannerId: "bnrEU1", language: "de" });
  });

  it("stores the new version and removes the previous one", async () => {
    const storage = cachedStorage(bundle());
    await make({
      storage,
      fetch: respond(bundle({ cache_version: "e5f6a7b8" })),
    }).revalidate();
    expect(storage.data.get(`cc_config:${ACCOUNT}`)).toBe("e5f6a7b8");
    expect(storage.data.has(`cc_config:${ACCOUNT}:a1b2c3d4`)).toBe(false);
    expect(make({ storage }).get().dashboard?.configVersion).toBe("e5f6a7b8");
  });

  it("reports category and re-consent changes unless reprompting is disabled", async () => {
    const run = (next: Bundle, reprompt?: boolean) =>
      make({
        reprompt,
        storage: cachedStorage(bundle()),
        fetch: respond(next),
      }).revalidate();
    expect((await run(renamed("v2", "Measurement"))).categoriesChanged).toBe(
      true,
    );
    expect(
      (
        await run(
          bundle({
            cache_version: "v2",
            reconsent_required_at: "2026-10-01T00:00:00Z",
          }),
        )
      ).categoriesChanged,
    ).toBe(true);
    expect((await run(bundle({ cache_version: "v2" }))).categoriesChanged).toBe(
      false,
    );
    expect(
      (await run(renamed("v2", "Measurement"), false)).categoriesChanged,
    ).toBe(false);
  });

  it("applies code override over dashboard over code defaults", async () => {
    const sync = make({
      defaults: {
        categories: [
          { id: "analytics", label: "Local", description: "Local text" },
          { id: "preferences", label: "Local preferences" },
        ],
      },
      override: {
        categories: [
          { id: "marketing", label: "Override ads", default: false },
        ],
      },
      fetch: respond(bundle()),
    });
    const { config } = await sync.revalidate();
    const byId = Object.fromEntries(
      config.categories.map((category) => [category.id, category]),
    );
    expect(byId.analytics).toMatchObject({
      label: "Analytics",
      description: "Helps us understand usage",
    });
    expect(byId.preferences).toMatchObject({ label: "Local preferences" });
    expect(byId.marketing).toMatchObject({
      label: "Override ads",
      default: false,
    });
  });

  it("deduplicates concurrent revalidations and notifies subscribers", async () => {
    const fetch = respond(bundle());
    const sync = make({ fetch });
    const seen: string[] = [];
    sync.subscribe((state) => seen.push(state.status));
    await Promise.all([sync.revalidate(), sync.revalidate()]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(seen).toEqual(["loading", "ready"]);
  });
});

describe("createSync failure handling", () => {
  const hostile: [string, () => ReturnType<typeof respond>][] = [
    ["a server error", () => respond("", { status: 500 })],
    [
      "the platform 404",
      () => respond({ error: "No banners configured" }, { status: 404 }),
    ],
    ["invalid JSON", () => respond("{not json")],
    [
      "a future schema",
      () => respond(bundle({ cache_version: "v9", schema_version: 2 })),
    ],
    [
      "another account",
      () => respond(bundle({ cache_version: "v9", account_hashid: "other" })),
    ],
    ["an oversized body", () => respond(" ".repeat(524289))],
    ["a 304 without a cache", () => respond("", { status: 304 })],
  ];

  it.each(hostile)("keeps the cached config on %s", async (name, factory) => {
    const storage = cachedStorage(renamed("a1b2c3d4", "Cached"));
    const state = await make({ storage, fetch: factory() }).revalidate();
    expect(label(state)).toBe("Cached");
    expect(storage.data.get(`cc_config:${ACCOUNT}`)).toBe("a1b2c3d4");
    if (name !== "a 304 without a cache") expect(state.status).toBe("error");
  });

  it.each(hostile)("keeps the local config on %s", async (_name, factory) => {
    const state = await make({ fetch: factory() }).revalidate();
    expect(state).toMatchObject({ status: "error", source: "local" });
    expect(label(state)).toBe("Local analytics");
  });

  it("falls back when offline", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const state = await make({
      fetch,
      storage: cachedStorage(renamed("a1b2c3d4", "Cached")),
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

  it("ignores tampered, mismatched, foreign or unreadable cache entries", () => {
    const broken = [
      memoryStorage({
        [`cc_config:${ACCOUNT}`]: "a1b2c3d4",
        [`cc_config:${ACCOUNT}:a1b2c3d4`]: "{bad",
      }),
      memoryStorage({
        [`cc_config:${ACCOUNT}`]: "zzz",
        [`cc_config:${ACCOUNT}:zzz`]: FIXTURE,
      }),
      cachedStorage(bundle({ account_hashid: "other" })),
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
    expect(
      (await make({ storage, fetch: respond(bundle()) }).revalidate()).status,
    ).toBe("ready");
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
    resolve(new Response(FIXTURE));
    await pending;
    expect(listener).not.toHaveBeenCalled();
    await sync.revalidate();
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("prototype pollution", () => {
  it("drops prototype keys from a remote bundle and never stores them", async () => {
    const body = FIXTURE.replace(
      '"version": 4,',
      '"version": 4, "__proto__": {"polluted": 1}, "constructor": {"prototype": {"polluted": 1}},',
    ).replace(
      '"slug": "analytics",',
      '"slug": "analytics", "__proto__": {"polluted": 1},',
    );
    const storage = memoryStorage();
    const state = await make({ storage, fetch: respond(body) }).revalidate();
    expect(state.status).toBe("ready");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(label(state)).toBe("Analytics");
    expect(storage.data.get(`cc_config:${ACCOUNT}:a1b2c3d4`)).not.toMatch(
      /__proto__|constructor|prototype/,
    );
    expect(make({ storage }).get().dashboard?.categories[1]).not.toHaveProperty(
      "polluted",
    );
  });

  it("does not pollute when a category slug or service id is __proto__", async () => {
    const value = bundle({
      categories: [
        {
          slug: "__proto__",
          name: "x",
          services: [{ id: "__proto__", name: "y" }],
        },
      ],
    });
    const state = await make({ fetch: respond(value) }).revalidate();
    expect(({} as Record<string, unknown>).label).toBeUndefined();
    expect(({} as Record<string, unknown>).category).toBeUndefined();
    expect(["ready", "error"]).toContain(state.status);
  });
});
