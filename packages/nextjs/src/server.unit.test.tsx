import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ConsentState, encodeConsentCookie } from "@cookiechimp/core";
import { useTranslations } from "@cookiechimp/react";
import en from "@cookiechimp/translations/en";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  cookies: new Map<string, string>(),
  cookieRequests: [] as Map<string, string>[],
  values: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => {
    const requestCookies = mocks.cookieRequests.shift() ?? mocks.cookies;
    return {
      get: (name: string) => {
        const value =
          requestCookies.get(name) ??
          (name === "cc_consent" ? mocks.cookie : undefined);
        return value ? { name, value } : undefined;
      },
    };
  },
  headers: async () => ({
    get: (name: string) => mocks.values.get(name.toLowerCase()) ?? null,
  }),
}));

import { CookieChimpProvider, getServerConsent } from "./server";

const state: ConsentState = {
  schemaVersion: 1,
  consentId: "1234567890abcdef",
  ts: "2026-01-01T00:00:00.000Z",
  categories: { necessary: true, analytics: true },
  action: "accept_all",
};

beforeEach(() => {
  mocks.cookie = undefined;
  mocks.cookies.clear();
  mocks.cookieRequests.length = 0;
  mocks.values.clear();
});

describe("getServerConsent", () => {
  it("returns null when the cookie is absent or invalid", async () => {
    expect(await getServerConsent()).toBeNull();
    mocks.cookie = "invalid";
    expect(await getServerConsent()).toBeNull();
  });

  it("reads a valid App Router cookie", async () => {
    mocks.cookie = encodeConsentCookie(state);
    expect(await getServerConsent()).toEqual(state);
  });

  it.each([
    ["an oversized cookie", `v1.${"a".repeat(32_769)}`],
    ["malformed percent encoding", "%E0%A4%A"],
    ["invalid JSON", "v1.e25vdC1qc29ufQ"],
  ])("returns null without throwing for %s", async (_label, value) => {
    mocks.cookie = value;
    await expect(getServerConsent()).resolves.toBeNull();
  });

  it("does not share cookie state between concurrent requests", async () => {
    const other = { ...state, consentId: "fedcba0987654321" };
    mocks.cookieRequests.push(
      new Map([["cc_consent", encodeConsentCookie(state)]]),
      new Map([["cc_consent", encodeConsentCookie(other)]]),
    );
    const [first, second] = await Promise.all([
      getServerConsent(),
      getServerConsent(),
    ]);
    expect(first?.consentId).toBe(state.consentId);
    expect(second?.consentId).toBe(other.consentId);
  });

  it("adds opted-in region, regulation, and language request context", async () => {
    mocks.cookie = encodeConsentCookie(state);
    mocks.values.set("x-vercel-ip-country", "US");
    mocks.values.set("x-vercel-ip-country-region", "CA");
    mocks.values.set("accept-language", "de-DE");
    await expect(
      getServerConsent({ provider: "vercel", languages: ["en", "de"] }),
    ).resolves.toMatchObject({
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
      language: "de",
    });
  });

  it("uses an explicitly supplied region without a provider", async () => {
    mocks.cookie = encodeConsentCookie(state);
    await expect(
      getServerConsent({ region: { country: "US", region: "CA" } }),
    ).resolves.toMatchObject({
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
    });
  });

  it("ignores a spoofed forwarded region by default", async () => {
    mocks.cookie = encodeConsentCookie(state);
    mocks.values.set("x-cc-region", "US-CA");
    await expect(
      getServerConsent({ languages: ["en"] }),
    ).resolves.toMatchObject({ region: null });
  });

  it("uses the forwarded region when explicitly trusted", async () => {
    mocks.cookie = encodeConsentCookie(state);
    mocks.values.set("x-cc-region", "US-CA");
    await expect(
      getServerConsent({ trustForwardedRegion: true }),
    ).resolves.toMatchObject({
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
    });
  });

  it("does not derive request region from consent cookie state", async () => {
    mocks.cookie = encodeConsentCookie({
      ...state,
      region: { country: "DE" },
      regulation: "gdpr",
    });
    await expect(
      getServerConsent({ languages: ["en"] }),
    ).resolves.toMatchObject({ region: null });
  });

  it("ignores a client-writable cookie region without an explicit source", async () => {
    mocks.cookie = encodeConsentCookie({
      ...state,
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
    });
    await expect(
      getServerConsent({ languages: ["en"] }),
    ).resolves.toMatchObject({ region: null, regulation: "gdpr" });
  });

  it("throws in development and warns in production for invalid options", async () => {
    await expect(getServerConsent({ cookieName: "bad name" })).rejects.toThrow(
      "cookieName",
    );
    vi.stubEnv("NODE_ENV", "production");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      getServerConsent({ cookieName: "bad name" }),
    ).resolves.toBeNull();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
    vi.unstubAllEnvs();
  });

  it("throws in development and warns in production for non-boolean forwarded trust", async () => {
    await expect(
      getServerConsent({ trustForwardedRegion: "yes" } as never),
    ).rejects.toThrow("trustForwardedRegion must be a boolean");
    vi.stubEnv("NODE_ENV", "production");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      getServerConsent({ trustForwardedRegion: "yes" } as never),
    ).resolves.toBeNull();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("trustForwardedRegion must be a boolean"),
    );
    warning.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("CookieChimpProvider", () => {
  it("resolves only opted-in geo headers and Accept-Language on the server", async () => {
    mocks.values.set("x-vercel-ip-country", "DE");
    mocks.values.set("accept-language", "de-DE,de;q=0.9");
    const output = await CookieChimpProvider({
      config: { categories: { analytics: false } },
      provider: "vercel",
      languages: { available: ["en", "de"], fallback: "en" },
      translations: () => en,
      children: <span>child</span>,
    });
    const html = renderToStaticMarkup(output);
    expect(html).toContain("child");
    expect(output.props.config).toMatchObject({
      region: { country: "DE" },
      regulation: "gdpr",
      language: "de",
    });
    expect(output.props.language).toBe("de");
    expect(output.props.messages).toBe(en);
  });

  it("does not trust provider headers without an explicit provider", async () => {
    mocks.values.set("x-vercel-ip-country", "DE");
    const output = await CookieChimpProvider({
      config: { categories: { analytics: false } },
      children: <span />,
    });
    expect(output.props.config.region).toBeNull();
  });

  it("accepts an already-resolved region", async () => {
    mocks.values.set("x-vercel-ip-country", "DE");
    const output = await CookieChimpProvider({
      config: { categories: { analytics: false } },
      region: { country: "US", region: "CA" },
      children: <span />,
    });
    expect(output.props.config).toMatchObject({
      region: { country: "US", region: "CA" },
      regulation: "ccpa",
    });
  });

  it("shares one custom config cookie name with server and client", async () => {
    mocks.cookies.set("custom_consent", encodeConsentCookie(state));
    const output = await CookieChimpProvider({
      config: {
        categories: { analytics: false },
        cookie: { name: "custom_consent" },
      },
      children: <span />,
    });
    expect(output.props.config.cookie.name).toBe("custom_consent");
    expect(output.props.initialState).toEqual(state);
  });
});

describe("CookieChimpProvider connected mode", () => {
  const fixture = readFileSync(
    resolve(__dirname, "../../core/src/fixtures/platform-offline-bundle.json"),
    "utf8",
  );
  const projectId = JSON.parse(fixture).account_hashid as string;
  function Title() {
    const { t } = useTranslations(en);
    return <h2>{t("banner.title")}</h2>;
  }

  it("renders dashboard copy and categories in SSR markup", async () => {
    mocks.values.set("x-vercel-ip-country", "DE");
    mocks.values.set("accept-language", "de-DE");
    const fetch = vi.fn(async () => new Response(fixture));
    vi.stubGlobal("fetch", fetch);
    try {
      const output = await CookieChimpProvider({
        config: { categories: [{ id: "local-only", label: "Local" }] },
        provider: "vercel",
        languages: { available: ["en", "de"], fallback: "en" },
        translations: en,
        projectId,
        override: { categories: [{ id: "marketing", label: "Ads (code)" }] },
        children: <Title />,
      });
      const html = renderToStaticMarkup(output);
      expect(html).toContain("Wir respektieren Ihre Privatsphäre");
      const ids = output.props.config.categories.map(
        (category: { id: string }) => category.id,
      );
      expect(ids).toEqual(
        expect.arrayContaining(["local-only", "analytics", "marketing"]),
      );
      expect(
        output.props.config.categories.find(
          (category: { id: string }) => category.id === "marketing",
        ).label,
      ).toBe("Ads (code)");
      // Unrelated code messages stay available under the dashboard copy.
      expect(output.props.messages["gated.allow"]).toBe(en["gated.allow"]);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders the code config when the dashboard is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    try {
      const output = await CookieChimpProvider({
        config: { categories: { analytics: false } },
        translations: en,
        projectId,
        children: <Title />,
      });
      expect(renderToStaticMarkup(output)).toContain(en["banner.title"]);
      expect(output.props.messages).toEqual(en);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("makes no request without projectId", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    try {
      await CookieChimpProvider({
        config: { categories: { analytics: false } },
        children: <Title />,
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
