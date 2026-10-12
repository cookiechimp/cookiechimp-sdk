import { consentMiddleware } from "@cookiechimp/nextjs/middleware";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return consentMiddleware(request, { provider: "cloudflare" });
}

export const config = { matcher: ["/legacy", "/strict/:path*"] };
