import { type ConsentState, encodeConsentCookie } from "@cookiechimp/core";
import { describe, expect, it } from "vitest";
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

  it("uses forwarded region and resolves language", () => {
    expect(
      getPagesConsentProps(
        { headers: { "x-cc-region": "US-CA", "accept-language": "de-DE" } },
        { config, languages: { available: ["en", "de"], fallback: "en" } },
      ),
    ).toMatchObject({
      region: { country: "US", region: "CA" },
      language: "de",
    });
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
