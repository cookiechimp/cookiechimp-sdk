export type Regulation = "gdpr" | "ccpa" | "none";

export interface Region {
  country: string;
  region?: string;
}

export type HeaderSource =
  | Headers
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

export interface RegionHeaderOptions {
  provider?: "vercel" | "cloudflare" | "cloudfront" | "custom";
  /** Country header name for the custom provider. */
  header?: string;
  /** Optional subdivision header name for the custom provider. */
  regionHeader?: string;
}

function header(source: HeaderSource, name: string): string | null {
  if ("get" in source && typeof source.get === "function")
    return source.get(name);
  const key = Object.keys(source).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  const value = key
    ? (source as Record<string, string | string[] | undefined>)[key]
    : undefined;
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Resolve geo headers only for the explicitly trusted infrastructure provider. */
export function resolveRegion(
  headers: HeaderSource,
  options: RegionHeaderOptions = {},
): Region | null {
  const names =
    options.provider === "vercel"
      ? ["x-vercel-ip-country", "x-vercel-ip-country-region"]
      : options.provider === "cloudflare"
        ? ["cf-ipcountry", "cf-region-code"]
        : options.provider === "cloudfront"
          ? ["cloudfront-viewer-country", "cloudfront-viewer-country-region"]
          : options.provider === "custom" && options.header
            ? [options.header, options.regionHeader]
            : null;
  if (!names) return null;
  const country =
    header(headers, names[0] ?? "")
      ?.trim()
      .toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(country) || country === "XX" || country === "T1")
    return null;
  let region = names[1]
    ? (header(headers, names[1])?.trim().toUpperCase() ?? "")
    : "";
  if (region.startsWith(`${country}-`)) region = region.slice(3);
  return {
    country,
    ...(/^[A-Z0-9]{1,3}$/.test(region) ? { region } : {}),
  };
}

/** Read Global Privacy Control without assuming a browser environment. */
export function readGpc(headers?: HeaderSource): boolean {
  return headers
    ? header(headers, "sec-gpc")?.trim() === "1"
    : typeof navigator !== "undefined" &&
        (navigator as Navigator & { globalPrivacyControl?: boolean })
          .globalPrivacyControl === true;
}

export const GDPR_COUNTRIES = new Set(
  "AT BE BG HR CY CZ DE DK EE ES FI FR GR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK GB CH".split(
    " ",
  ),
);

/** States whose broad consumer privacy opt-out laws are already effective. */
export const US_OPT_OUT_STATES = new Set(
  "CA CO CT DE IA IN KY MD MN MT NE NH NJ OR RI TN TX UT VA".split(" "),
);

const FUTURE_US_OPT_OUT_STATES = new Map([
  ["OK", Date.UTC(2027, 0, 1)],
  ["LA", Date.UTC(2027, 0, 1)],
  ["AL", Date.UTC(2027, 4, 1)],
  ["VT", Date.UTC(2028, 0, 1)],
]);

export function defaultRegulation(
  region: Region | null,
  fallback: Regulation = "gdpr",
  now = Date.now(),
): Regulation {
  if (!region) return fallback;
  if (GDPR_COUNTRIES.has(region.country)) return "gdpr";
  if (region.country === "US" && region.region) {
    if (US_OPT_OUT_STATES.has(region.region)) return "ccpa";
    const effective = FUTURE_US_OPT_OUT_STATES.get(region.region);
    if (effective !== undefined && now >= effective) return "ccpa";
  }
  return "none";
}

/** Resolve the built-in regulation for a region at an injectable point in time. */
export function regulationFor(
  region: Region | null,
  now = Date.now(),
): Regulation {
  return defaultRegulation(region, "gdpr", now);
}
