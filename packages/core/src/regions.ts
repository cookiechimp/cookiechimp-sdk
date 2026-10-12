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
  /** A country header checked before the built-in provider headers. */
  customHeader?: string;
  /** Optional subdivision header paired with customHeader. */
  customRegionHeader?: string;
}

function header(source: HeaderSource | undefined, name: string): string | null {
  if (!source) return null;
  if ("get" in source && typeof source.get === "function")
    return source.get(name);
  const key = Object.keys(source).find(
    (candidate) => candidate.toLowerCase() === name,
  );
  const value = key
    ? (source as Record<string, string | string[] | undefined>)[key]
    : undefined;
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Resolve custom, Vercel, Cloudflare, CloudFront, then generic geo headers. */
export function resolveRegion(
  headers: HeaderSource,
  options: RegionHeaderOptions = {},
): Region | null {
  for (const [countryName, regionName] of [
    [options.customHeader, options.customRegionHeader],
    ["x-vercel-ip-country", "x-vercel-ip-country-region"],
    ["cf-ipcountry", "cf-region-code"],
    ["cloudfront-viewer-country", "cloudfront-viewer-country-region"],
    ["x-country-code", "x-region-code"],
  ]) {
    if (!countryName) continue;
    const country = header(headers, countryName)?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]{2}$/.test(country) || country === "XX" || country === "T1")
      continue;
    let region = regionName
      ? (header(headers, regionName)?.trim().toUpperCase() ?? "")
      : "";
    if (region.startsWith(`${country}-`)) region = region.slice(3);
    return {
      country,
      ...(/^[A-Z0-9]{1,3}$/.test(region) ? { region } : {}),
    };
  }
  return null;
}

/** Read Global Privacy Control without assuming a browser environment. */
export function readGpc(headers?: HeaderSource): boolean {
  return headers
    ? header(headers, "sec-gpc")?.trim() === "1"
    : typeof navigator !== "undefined" &&
        (navigator as Navigator & { globalPrivacyControl?: boolean })
          .globalPrivacyControl === true;
}

// EU and EEA members, plus the UK and Switzerland.
const GDPR =
  "AT BE BG HR CY CZ DE DK EE ES FI FR GR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK GB CH";

// States with broad consumer opt-out privacy laws. This is intentionally a
// CCPA-style behavior model, not a claim that each statute is identical.
export const US_OPT_OUT_STATES = Object.freeze(
  "CA CO CT DE IA IN KY MD MN MT NE NH NJ OR RI TN TX UT VA".split(" "),
);

export function defaultRegulation(
  region: Region | null,
  fallback: Regulation = "gdpr",
): Regulation {
  if (!region) return fallback;
  if (GDPR.includes(region.country)) return "gdpr";
  if (
    region.country === "US" &&
    region.region &&
    US_OPT_OUT_STATES.includes(region.region)
  )
    return "ccpa";
  return "none";
}

/** Resolve the built-in regulation for a region before creating consent. */
export const regulationFor = defaultRegulation;
