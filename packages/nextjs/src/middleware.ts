import { type Region, resolveRegion } from "@cookiechimp/core/regions";
import { type NextRequest, NextResponse } from "next/server";

export type RegionMiddlewareProvider =
  | "vercel"
  | "cloudflare"
  | { header: string; regionHeader?: string };

export interface RegionMiddlewareOptions {
  provider?: RegionMiddlewareProvider;
  requestHeader?: string;
}

function invalid(message: string): void {
  const text = `Invalid CookieChimp middleware options: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(text);
  console.warn(text);
}

function encoded(region: Region) {
  return `${region.country}${region.region ? `-${region.region}` : ""}`;
}

const headerName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Copy only an explicitly trusted platform header into a normalized request header. */
export function withRegionHeaders(
  headers: Headers,
  options: RegionMiddlewareOptions = {},
): Headers {
  const outputName = options.requestHeader ?? "x-cc-region";
  const output = new Headers(headers);
  if (!headerName.test(outputName)) {
    invalid("requestHeader must be a valid header name");
    output.delete("x-cc-region");
    return output;
  }
  output.delete(outputName);
  if (options.provider === undefined) return output;
  const provider = options.provider;
  const validProvider =
    provider === "vercel" ||
    provider === "cloudflare" ||
    (typeof provider === "object" &&
      provider !== null &&
      typeof provider.header === "string" &&
      headerName.test(provider.header) &&
      (provider.regionHeader === undefined ||
        (typeof provider.regionHeader === "string" &&
          headerName.test(provider.regionHeader))));
  if (!validProvider) {
    invalid("provider must be vercel, cloudflare, or a custom header object");
    return output;
  }
  const region =
    typeof provider === "string"
      ? resolveRegion(headers, { provider })
      : resolveRegion(headers, {
          provider: "custom",
          header: provider.header,
          regionHeader: provider.regionHeader,
        });
  if (region) output.set(outputName, encoded(region));
  return output;
}

/** Next.js middleware which performs no lookup and only forwards host-set geo headers. */
export function consentMiddleware(
  request: NextRequest,
  options: RegionMiddlewareOptions = {},
) {
  return NextResponse.next({
    request: { headers: withRegionHeaders(request.headers, options) },
  });
}
