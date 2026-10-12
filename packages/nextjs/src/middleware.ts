import {
  type Region,
  type RegionHeaderOptions,
  resolveRegion,
} from "@cookiechimp/core/regions";
import { type NextRequest, NextResponse } from "next/server";

export interface RegionMiddlewareOptions extends RegionHeaderOptions {
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

/** Copy only an explicitly trusted platform header into a normalized request header. */
export function withRegionHeaders(
  headers: Headers,
  options: RegionMiddlewareOptions,
): Headers {
  if (!options.provider)
    invalid("provider is required to prevent trusting spoofed headers");
  if (options.provider === "custom" && !options.header)
    invalid("header is required for the custom provider");
  const outputName = options.requestHeader ?? "x-cc-region";
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(outputName))
    invalid("requestHeader must be a valid header name");
  const output = new Headers(headers);
  output.delete(outputName);
  const region = resolveRegion(headers, options);
  if (region) output.set(outputName, encoded(region));
  return output;
}

/** Next.js middleware which performs no lookup and only forwards host-set geo headers. */
export function consentMiddleware(
  request: NextRequest,
  options: RegionMiddlewareOptions,
) {
  return NextResponse.next({
    request: { headers: withRegionHeaders(request.headers, options) },
  });
}
