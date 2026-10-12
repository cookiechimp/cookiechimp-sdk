import { type ConsentState, encodeConsentCookie } from "@cookiechimp/core";
import en from "@cookiechimp/translations/en";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  values: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "cc_consent" && mocks.cookie
        ? { name, value: mocks.cookie }
        : undefined,
  }),
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
});
