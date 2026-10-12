import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultRegulation,
  GDPR_COUNTRIES,
  readGpc,
  regulationFor,
  resolveRegion,
  US_OPT_OUT_STATES,
} from "./regions";

afterEach(() => vi.unstubAllGlobals());

describe("resolveRegion", () => {
  it.each([
    [
      "vercel",
      { "x-vercel-ip-country": " de ", "x-vercel-ip-country-region": "de-be" },
      { country: "DE", region: "BE" },
    ],
    [
      "cloudflare",
      { "CF-IPCountry": "us", "CF-Region-Code": "ca" },
      { country: "US", region: "CA" },
    ],
    [
      "cloudfront",
      {
        "cloudfront-viewer-country": "gb",
        "cloudfront-viewer-country-region": "eng",
      },
      { country: "GB", region: "ENG" },
    ],
  ] as const)(
    "reads only the %s provider headers",
    (provider, headers, expected) => {
      expect(resolveRegion(new Headers(headers), { provider })).toEqual(
        expected,
      );
    },
  );

  it("reads explicitly named custom headers", () => {
    expect(
      resolveRegion(
        { geo: "ca", subdivision: "on", "x-vercel-ip-country": "DE" },
        { provider: "custom", header: "geo", regionHeader: "subdivision" },
      ),
    ).toEqual({ country: "CA", region: "ON" });
  });

  it("does not trust headers without a selected provider", () => {
    expect(resolveRegion({ "x-vercel-ip-country": "DE" })).toBeNull();
    expect(
      resolveRegion({ "x-country-code": "DE" }, { provider: "vercel" }),
    ).toBeNull();
  });

  it("returns null when custom has no country header name", () => {
    expect(resolveRegion({ geo: "DE" }, { provider: "custom" })).toBeNull();
  });

  it.each([
    ["cloudflare", { "x-vercel-ip-country": "US" }],
    ["vercel", { "cf-ipcountry": "DE" }],
  ] as const)(
    "ignores spoofed headers for provider %s",
    (provider, headers) => {
      expect(resolveRegion(headers, { provider })).toBeNull();
    },
  );

  it.each(["", "X", "USA", "XX", "T1", "D3"])(
    "ignores invalid country %j",
    (value) => {
      expect(
        resolveRegion({ "x-vercel-ip-country": value }, { provider: "vercel" }),
      ).toBeNull();
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
  const gdprCountries =
    "AT BE BG HR CY CZ DE DK EE ES FI FR GR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK GB CH".split(
      " ",
    );

  it.each(gdprCountries)("maps GDPR country %s to GDPR", (country) => {
    expect(defaultRegulation({ country })).toBe("gdpr");
  });

  it("keeps the exported GDPR table complete", () => {
    expect([...GDPR_COUNTRIES]).toEqual(gdprCountries);
  });

  it("stores currently effective US opt-out states as a Set", () => {
    expect(US_OPT_OUT_STATES).toBeInstanceOf(Set);
    expect(defaultRegulation({ country: "US", region: "CA" })).toBe("ccpa");
    expect(defaultRegulation({ country: "US", region: "NY" })).toBe("none");
  });

  it.each([
    ["OK", "2027-01-01"],
    ["LA", "2027-01-01"],
    ["AL", "2027-05-01"],
    ["VT", "2028-01-01"],
  ])("activates %s on %s UTC", (state, date) => {
    const effective = Date.parse(`${date}T00:00:00.000Z`);
    const region = { country: "US", region: state };
    expect(regulationFor(region, effective - 86_400_000)).toBe("none");
    expect(regulationFor(region, effective)).toBe("ccpa");
  });

  it("uses the safe configurable unknown fallback", () => {
    expect(defaultRegulation(null)).toBe("gdpr");
    expect(defaultRegulation(null, "none")).toBe("none");
  });
});
