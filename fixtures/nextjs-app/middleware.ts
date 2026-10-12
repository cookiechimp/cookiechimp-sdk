import { withRegionHeaders } from "@cookiechimp/nextjs/middleware";
import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = withRegionHeaders(request.headers, {
    provider: "cloudflare",
  });
  if (!request.nextUrl.pathname.startsWith("/strict"))
    return NextResponse.next({ request: { headers: requestHeaders } });
  const nonce = btoa(crypto.randomUUID());
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'self'`;
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = { matcher: ["/legacy", "/strict/:path*"] };
