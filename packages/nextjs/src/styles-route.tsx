import "server-only";

import { createHash } from "node:crypto";
import type { LinkHTMLAttributes } from "react";
import { criticalCss, fullCss } from "./critical-css.generated";

const css = `${criticalCss}\n${fullCss}`;
const etag = `"${createHash("sha256").update(css).digest("base64url")}"`;
const immutableCache = "public, max-age=31536000, immutable";
const requestCache = "private, no-cache";

export interface StylesRouteOptions {
  request?: Request;
  nonce?: (request: Request) => string | undefined;
  contentSecurityPolicy?: string | ((nonce: string | undefined) => string);
}

function invalid(message: string): void {
  const text = `Invalid CookieChimp styles route options: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(text);
  console.warn(text);
}

function validate(options: StylesRouteOptions): boolean {
  if (options.nonce !== undefined && typeof options.nonce !== "function") {
    invalid("nonce must be a function");
    return false;
  }
  if (
    options.contentSecurityPolicy !== undefined &&
    typeof options.contentSecurityPolicy !== "string" &&
    typeof options.contentSecurityPolicy !== "function"
  ) {
    invalid("contentSecurityPolicy must be a string or function");
    return false;
  }
  return true;
}

function responseFor(
  request: Request | undefined,
  options: StylesRouteOptions,
) {
  const valid = validate(options);
  const nonce =
    valid && options.nonce && request ? options.nonce(request) : undefined;
  const policy =
    valid && typeof options.contentSecurityPolicy === "function"
      ? options.contentSecurityPolicy(nonce)
      : valid && typeof options.contentSecurityPolicy === "string"
        ? options.contentSecurityPolicy
        : undefined;
  const dynamic =
    options.nonce !== undefined || options.contentSecurityPolicy !== undefined;
  const headers = new Headers({
    "cache-control": dynamic ? requestCache : immutableCache,
    "content-type": "text/css; charset=utf-8",
    "x-content-type-options": "nosniff",
    etag,
  });
  if (policy) headers.set("content-security-policy", policy);
  if (request?.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return new Response(css, { status: 200, headers });
}

/** Strict-CSP Route Handler serving CookieChimp CSS without an inline style. */
export function stylesRoute(
  options: StylesRouteOptions | Request = {},
): Response {
  if (options instanceof Request) return responseFor(options, {});
  return responseFor(options.request, options);
}

/** Create a Route Handler with per-request nonce and CSP configuration. */
export function createStylesRoute(
  options: Omit<StylesRouteOptions, "request">,
) {
  return (request: Request) => responseFor(request, options);
}

export interface StylesLinkProps
  extends Omit<LinkHTMLAttributes<HTMLLinkElement>, "rel"> {
  href?: string;
  nonce?: string;
}

/** Render the same-origin stylesheet link used by strict CSP pages. */
export function StylesLink({
  href = "/cookiechimp.css",
  nonce,
  ...props
}: StylesLinkProps) {
  return <link {...props} rel="stylesheet" href={href} nonce={nonce} />;
}
