import type { Region } from "@cookiechimp/core";

const COUNTRY = /^[A-Z]{2}$/;
const SUBDIVISION = /^[A-Z0-9]{1,3}$/;

/** Parse `DE`, `US-CA` or `{ country, region }` into a core region. */
export function parseRegion(
  value: string | Region | null | undefined,
): Region | null {
  if (!value) return null;
  const [country = "", region = ""] =
    typeof value === "string"
      ? value.trim().toUpperCase().split("-")
      : [
          String(value.country).toUpperCase(),
          String(value.region ?? "")
            .toUpperCase()
            .replace(/^[A-Z]{2}-/, ""),
        ];
  if (!COUNTRY.test(country) || country === "XX") return null;
  return SUBDIVISION.test(region) ? { country, region } : { country };
}

/** The `country_banner_map` key for a region, for example `US-CA`. */
export const regionKey = (region: Region | null) =>
  region ? `${region.country}${region.region ? `-${region.region}` : ""}` : "";

/**
 * Ask the CookieChimp platform where the device's connection is. This is the
 * account's own first-party endpoint (IP based); no third-party location
 * service is contacted and device location permissions are never used.
 * Resolves null on any failure.
 */
export async function fetchRegion(options: {
  accountId: string;
  apiBase: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<Region | null> {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!doFetch || !/^[\w-]{1,64}$/.test(options.accountId)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 3000);
  try {
    const response = await doFetch(
      `${options.apiBase}/api/v1/mobile-sdk/geolocation/${options.accountId}`,
      {
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 4096) return null;
    const body = JSON.parse(text) as { country?: unknown; region?: unknown };
    if (typeof body?.country !== "string") return null;
    return parseRegion({
      country: body.country,
      region: typeof body.region === "string" ? body.region : undefined,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
