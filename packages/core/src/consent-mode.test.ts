import { afterEach, describe, expect, it, vi } from "vitest";
import { consentModeDefault, consentModeInlineScript } from "./consent-mode";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("consentModeDefault", () => {
  it("maps categories to all Consent Mode v2 signals", () => {
    expect(
      consentModeDefault({
        categories: { analytics: true, marketing: true, functional: true },
      }),
    ).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "granted",
      security_storage: "granted",
      wait_for_update: 500,
    });
  });

  it("supports custom mappings, regions, and wait time", () => {
    expect(
      consentModeDefault({
        categories: { measurement: true },
        mapping: { measurement: ["analytics_storage"] },
        region: ["US-CA", "DE"],
        wait_for_update: 250,
      }),
    ).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
      security_storage: "granted",
      region: ["US-CA", "DE"],
      wait_for_update: 250,
    });
  });

  it("never emits a script-closing sequence in inline scripts", () => {
    const script = consentModeInlineScript({
      mapping: { "</script><script>alert(1)</script>": ["ad_storage"] },
    });
    expect(script).not.toContain("</script>");
  });

  it("throws for invalid options in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => consentModeDefault({ wait_for_update: -1 })).toThrow(
      "wait_for_update",
    );
  });

  it("warns and uses safe defaults in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(consentModeDefault({ wait_for_update: Number.NaN })).toMatchObject({
      wait_for_update: 500,
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});
