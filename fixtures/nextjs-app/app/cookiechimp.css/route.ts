import { createStylesRoute } from "@cookiechimp/nextjs/styles-route";

export const GET = createStylesRoute({
  nonce: (request) => request.headers.get("x-nonce") ?? undefined,
  contentSecurityPolicy: (nonce) =>
    `default-src 'none'; style-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
});
