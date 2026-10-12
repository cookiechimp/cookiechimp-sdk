import { type ConsentState, encodeConsentCookie } from "@cookiechimp/core";
import { describe, expect, it, vi } from "vitest";
import { getPagesConsentProps, withConsent } from "./pages";

const config = { categories: { analytics: false } };
const state: ConsentState = {
  schemaVersion: 1,
  consentId: "1234567890abcdef",
  ts: "2026-01-01T00:00:00.000Z",
  categories: { necessary: true },
  action: "custom",
};

describe("Pages Router consent", () => {
  it("reads absent, invalid, and valid cookies", () => {
    expect(
      getPagesConsentProps({ headers: {} }, { config }).consent,
    ).toBeNull();
    expect(
      getPagesConsentProps(
        { headers: { cookie: "cc_consent=bad" } },
        { config },
      ).consent,
    ).toBeNull();
    expect(
      getPagesConsentProps(
        { headers: { cookie: `cc_consent=${encodeConsentCookie(state)}` } },
        { config },
      ).consent,
    ).toEqual(state);
    expect(
      getPagesConsentProps(
        { headers: { cookie: `custom=${encodeConsentCookie(state)}` } },
        { config: { ...config, cookie: { name: "custom" } } },
      ).consent,
    ).toEqual(state);
  });

  it("ignores a spoofed forwarded region by default", async () => {
    const wrapped = withConsent({ config });
    await expect(
      wrapped({ req: { headers: { "x-cc-region": "US-CA" } } }),
    ).resolves.toMatchObject({ props: { cookiechimp: { region: null } } });
  });

  it("uses forwarded region when explicitly trusted and resolves language", async () => {
    const wrapped = withConsent({
      config,
      trustForwardedRegion: true,
      languages: { available: ["en", "de"], fallback: "en" },
    });
    expect(
      await wrapped({
        req: {
          headers: { "x-cc-region": "US-CA", "accept-language": "de-DE" },
        },
      }),
    ).toMatchObject({
      props: {
        cookiechimp: {
          region: { country: "US", region: "CA" },
          language: "de",
        },
      },
    });
  });

  it("throws in development and warns in production for non-boolean forwarded trust", () => {
    expect(() =>
      withConsent({ config, trustForwardedRegion: "yes" } as never),
    ).toThrow("trustForwardedRegion must be a boolean");
    vi.stubEnv("NODE_ENV", "production");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    withConsent({ config, trustForwardedRegion: "yes" } as never);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("trustForwardedRegion must be a boolean"),
    );
    warning.mockRestore();
    vi.unstubAllEnvs();
  });

  it("merges getServerSideProps", async () => {
    const wrapped = withConsent(config ? { config } : { config }, async () => ({
      props: { answer: 42 },
    }));
    await expect(wrapped({ req: { headers: {} } })).resolves.toEqual({
      props: { answer: 42, cookiechimp: { consent: null, region: null } },
    });
  });
});
