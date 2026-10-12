import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStylesRoute, StylesLink, stylesRoute } from "./styles-route";

describe("stylesRoute", () => {
  it("serves CSS with immutable caching and validates its ETag", async () => {
    const response = stylesRoute();
    expect(response.headers.get("content-type")).toBe(
      "text/css; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain(".cc-banner");
    const request = new Request("https://example.test/cookiechimp.css", {
      headers: { "if-none-match": response.headers.get("etag") ?? "" },
    });
    expect(stylesRoute(request).status).toBe(304);
  });

  it("resolves a nonce into CSP and disables immutable caching", () => {
    const handler = createStylesRoute({
      nonce: (request) => request.headers.get("x-nonce") ?? undefined,
      contentSecurityPolicy: (nonce) => `style-src 'self' 'nonce-${nonce}'`,
    });
    const response = handler(
      new Request("https://example.test/cookiechimp.css", {
        headers: { "x-nonce": "abc123" },
      }),
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "style-src 'self' 'nonce-abc123'",
    );
    expect(response.headers.get("cache-control")).not.toContain("immutable");
    expect(response.headers.get("cache-control")).toContain("no-cache");
  });

  it("renders a nonce-bearing stylesheet link", () => {
    expect(
      renderToStaticMarkup(
        StylesLink({ href: "/assets/consent.css", nonce: "abc123" }),
      ),
    ).toBe(
      '<link rel="stylesheet" href="/assets/consent.css" nonce="abc123"/>',
    );
  });

  it("throws for invalid options in development and warns in production", () => {
    expect(() => stylesRoute({ nonce: "bad" as never })).toThrow("nonce");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = stylesRoute({ contentSecurityPolicy: 1 as never });
    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
