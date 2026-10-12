import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultRegulation, readGpc, resolveRegion } from "./regions";

afterEach(() => vi.unstubAllGlobals());

describe("resolveRegion", () => {
  it("uses documented provider priority and normalises values", () => {
    expect(
      resolveRegion(
        new Headers({
          "x-vercel-ip-country": " de ",
          "x-vercel-ip-country-region": "de-be",
          "cf-ipcountry": "US",
        }),
      ),
    ).toEqual({ country: "DE", region: "BE" });
    expect(
      resolveRegion({ "CF-IPCountry": "us", "CF-Region-Code": "ca" }),
    ).toEqual({ country: "US", region: "CA" });
    expect(
      resolveRegion({
        "cloudfront-viewer-country": "gb",
        "cloudfront-viewer-country-region": "eng",
      }),
    ).toEqual({ country: "GB", region: "ENG" });
    expect(
      resolveRegion({ "x-country-code": ["ch"], "x-region-code": "zh" }),
    ).toEqual({ country: "CH", region: "ZH" });
  });

  it("supports priority custom headers", () => {
    expect(
      resolveRegion(
        { geo: "ca", subdivision: "on", "x-vercel-ip-country": "DE" },
        {
          customHeader: "geo",
          customRegionHeader: "subdivision",
        },
      ),
    ).toEqual({ country: "CA", region: "ON" });
  });

  it.each(["", "X", "USA", "XX", "T1", "D3"])(
    "ignores invalid country %j",
    (value) => {
      expect(resolveRegion({ "x-country-code": value })).toBeNull();
    },
  );
});

describe("readGpc", () => {
  it("reads Sec-GPC only when its value is 1", () => {
    expect(readGpc(new Headers({ "Sec-GPC": "1" }))).toBe(true);
    expect(readGpc({ "sec-gpc": "0" })).toBe(false);
  });
  it("reads navigator and remains SSR safe", () => {
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    expect(readGpc()).toBe(true);
    vi.stubGlobal("navigator", undefined);
    expect(readGpc()).toBe(false);
  });
});

describe("defaultRegulation", () => {
  it.each(["DE", "IE", "GB", "CH"])("maps %s to GDPR", (country) => {
    expect(defaultRegulation({ country })).toBe("gdpr");
  });
  it("maps covered US states to the CCPA behavior model", () => {
    expect(defaultRegulation({ country: "US", region: "CA" })).toBe("ccpa");
    expect(defaultRegulation({ country: "US", region: "CO" })).toBe("ccpa");
    expect(defaultRegulation({ country: "US", region: "NY" })).toBe("none");
  });
  it("uses the safe configurable unknown fallback", () => {
    expect(defaultRegulation(null)).toBe("gdpr");
    expect(defaultRegulation(null, "none")).toBe("none");
  });
});
