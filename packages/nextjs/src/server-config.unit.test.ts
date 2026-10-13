import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dashboardCookie,
  dashboardMessages,
  getServerConfig,
} from "./server-config";

const fixture = readFileSync(
  resolve(__dirname, "../../core/src/fixtures/platform-offline-bundle.json"),
  "utf8",
);
const bundle = JSON.parse(fixture);
const projectId = bundle.account_hashid as string;
type Init = RequestInit & { next?: { revalidate?: number } };
const respond = (body: string, init?: ResponseInit) =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: Init) => new Response(body, init),
  );

beforeEach(() => vi.stubEnv("NODE_ENV", "development"));
afterEach(() => vi.unstubAllEnvs());

describe("getServerConfig", () => {
  it("fetches with the Next.js data cache and no credentials or redirects", async () => {
    const fetch = respond(fixture);
    const result = await getServerConfig({ projectId, fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `https://cookiechimp.com/api/v1/mobile-sdk/offline/${projectId}`,
    );
    expect(init).toMatchObject({
      credentials: "omit",
      redirect: "error",
      next: { revalidate: 300 },
    });
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(result.source).toBe("dashboard");
    expect(result.error).toBeUndefined();
    expect(result.config.categories.map((c) => c.id)).toEqual(
      expect.arrayContaining(["essential", "analytics", "marketing"]),
    );
  });

  it("honours a custom revalidate and apiBase", async () => {
    const fetch = respond(fixture);
    await getServerConfig({
      projectId,
      fetch,
      revalidate: 60,
      apiBase: "https://eu.cookiechimp.test/",
    });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `https://eu.cookiechimp.test/api/v1/mobile-sdk/offline/${projectId}`,
    );
    expect(fetch.mock.calls[0]?.[1]?.next).toEqual({ revalidate: 60 });
  });

  it("selects the banner and language from region and locale", async () => {
    const de = await getServerConfig({
      projectId,
      fetch: respond(fixture),
      region: { country: "DE" },
      locale: "de-AT",
    });
    expect(de.dashboard?.bannerId).toBe("bnrEU1");
    expect(de.messages["banner.title"]).toBe(
      "Wir respektieren Ihre Privatsphäre",
    );
    const us = await getServerConfig({
      projectId,
      fetch: respond(fixture),
      region: { country: "US", region: "CA" },
      locale: "en",
    });
    expect(us.dashboard?.bannerId).toBe("bnrUS1");
    expect(us.messages["banner.title"]).toBe("We value your privacy");
  });

  it("applies code defaults < dashboard < override", async () => {
    const result = await getServerConfig({
      projectId,
      fetch: respond(fixture),
      defaults: {
        categories: [
          { id: "analytics", label: "Local analytics" },
          { id: "local-only", label: "Local only" },
        ],
      },
      override: { categories: [{ id: "marketing", label: "Ads (code)" }] },
    });
    const label = (id: string) =>
      result.config.categories.find((c) => c.id === id)?.label;
    expect(label("local-only")).toBe("Local only");
    expect(label("analytics")).not.toBe("Local analytics");
    expect(label("marketing")).toBe("Ads (code)");
  });

  it.each([
    [
      "a 404",
      () => respond('{"error":"not found"}', { status: 404 }),
      "HTTP 404",
    ],
    ["invalid JSON", () => respond("{"), "invalid config"],
    [
      "another account",
      () => respond(JSON.stringify({ ...bundle, account_hashid: "acctOther" })),
      "invalid config",
    ],
    [
      "a newer schema",
      () => respond(JSON.stringify({ ...bundle, schema_version: 2 })),
      "invalid config",
    ],
    [
      "an oversized body",
      () => respond("x".repeat(524289)),
      "config too large",
    ],
    [
      "an oversized content-length",
      () => respond(fixture, { headers: { "content-length": "999999999" } }),
      "config too large",
    ],
    [
      "a network error",
      () =>
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      "network error",
    ],
  ])("renders the code config on %s", async (_name, make, error) => {
    const result = await getServerConfig({
      projectId,
      fetch: make() as typeof fetch,
      defaults: { categories: [{ id: "analytics", label: "Local analytics" }] },
    });
    expect(result.source).toBe("local");
    expect(result.dashboard).toBeUndefined();
    expect(result.messages).toEqual({});
    expect(result.error).toBe(error);
    expect(
      result.config.categories.find((c) => c.id === "analytics")?.label,
    ).toBe("Local analytics");
  });

  it("times out and renders the code config", async () => {
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          ),
        ),
    );
    const result = await getServerConfig({ projectId, fetch, timeoutMs: 20 });
    expect(result).toMatchObject({ source: "local", error: "timeout" });
  });

  it("drops prototype keys from the untrusted body", async () => {
    const hostile = fixture.replace(
      '"version"',
      '"__proto__": {"polluted": true}, "constructor": {"prototype": {"x": 1}}, "version"',
    );
    const result = await getServerConfig({
      projectId,
      fetch: respond(hostile),
    });
    expect(result.source).toBe("dashboard");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["an invalid projectId", { projectId: "../x" }],
    ["an http apiBase", { projectId, apiBase: "http://cookiechimp.com" }],
    [
      "a credentialed apiBase",
      { projectId, apiBase: "https://u:p@cookiechimp.com" },
    ],
    [
      "an apiBase with a query",
      { projectId, apiBase: "https://cookiechimp.com/?a=1" },
    ],
  ])(
    "refuses %s: throws in development, local config in production",
    async (_name, options) => {
      const fetch = respond(fixture);
      await expect(getServerConfig({ ...options, fetch })).rejects.toThrow(
        TypeError,
      );
      vi.stubEnv("NODE_ENV", "production");
      const result = await getServerConfig({ ...options, fetch });
      expect(result.source).toBe("local");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("treats a missing process as production for localhost http", async () => {
    const fetch = respond(fixture);
    const saved = globalThis.process;
    // @ts-expect-error simulate a runtime without process
    delete globalThis.process;
    try {
      const result = await getServerConfig({
        projectId,
        fetch,
        apiBase: "http://localhost:3000",
      });
      expect(result.source).toBe("local");
    } finally {
      globalThis.process = saved;
    }
    expect(fetch).not.toHaveBeenCalled();
    const dev = await getServerConfig({
      projectId,
      fetch,
      apiBase: "http://localhost:3000",
    });
    expect(dev.source).toBe("dashboard");
  });
});

describe("dashboardMessages", () => {
  it("keeps plain text and skips HTML, blank, long or non-string copy", () => {
    const messages = dashboardMessages({
      copy: {
        consent_modal: {
          title: "Hello",
          description: "<p>html</p>",
          accept_btn: " ",
          reject_btn: "x".repeat(501),
          preferences_btn: 3,
          close_btn: "Close",
        },
        preferences_modal: { title: "Prefs", save_btn: "Save it" },
      },
    } as never);
    expect(messages).toEqual({
      "banner.title": "Hello",
      "banner.close": "Close",
      "preferences.title": "Prefs",
      "banner.save": "Save it",
    });
    expect(dashboardMessages(undefined)).toEqual({});
  });
});

describe("dashboardCookie", () => {
  const dash = (cookie: unknown, banner: unknown = {}) =>
    ({ cookie, banner }) as never;
  it("uses cookie_settings and prefers the banner's expires_days", () => {
    expect(
      dashboardCookie(dash({ name: "cc_shop", expires_days: 182 })),
    ).toEqual({
      name: "cc_shop",
      maxAge: 182 * 86400,
    });
    expect(
      dashboardCookie(
        dash({ name: "cc_shop", expires_days: 182 }, { expires_days: 30 }),
      ),
    ).toEqual({ name: "cc_shop", maxAge: 30 * 86400 });
  });
  it.each([
    ["an invalid name", { name: "bad name;" }],
    ["a long name", { name: "x".repeat(65) }],
    ["zero days", { expires_days: 0 }],
    ["fractional days", { expires_days: 1.5 }],
    ["too many days", { expires_days: 731 }],
    ["string days", { expires_days: "30" }],
    ["nothing", {}],
  ])("ignores %s", (_name, cookie) => {
    expect(dashboardCookie(dash(cookie))).toBeUndefined();
  });
  it("is set on the server config from the platform bundle", async () => {
    const result = await getServerConfig({
      projectId,
      fetch: respond(fixture),
    });
    expect(result.cookie).toEqual({
      name: bundle.cookie_settings.name,
      maxAge: bundle.cookie_settings.expires_days * 86400,
    });
    const local = await getServerConfig({
      projectId,
      fetch: respond("", { status: 500 }),
    });
    expect(local.cookie).toBeUndefined();
  });
});
