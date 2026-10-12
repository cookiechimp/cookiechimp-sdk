import { createHash } from "node:crypto";
import { criticalCss, fullCss } from "./critical-css.generated";

const css = `${criticalCss}\n${fullCss}`;
const etag = `"${createHash("sha256").update(css).digest("base64url")}"`;

export interface StylesRouteOptions {
  request?: Request;
}

/** Strict-CSP Route Handler serving CookieChimp CSS without an inline style. */
export function stylesRoute(
  options: StylesRouteOptions | Request = {},
): Response {
  const request = options instanceof Request ? options : options.request;
  const headers = {
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": "text/css; charset=utf-8",
    etag,
  };
  if (request?.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return new Response(css, { status: 200, headers });
}
