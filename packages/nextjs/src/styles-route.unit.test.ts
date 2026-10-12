import { describe, expect, it } from "vitest";
import { stylesRoute } from "./styles-route";

describe("stylesRoute", () => {
  it("serves CSS with immutable caching and validates its ETag", async () => {
    const response = stylesRoute();
    expect(response.headers.get("content-type")).toBe(
      "text/css; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toContain(".cc-banner");
    const request = new Request("https://example.test/cookiechimp.css", {
      headers: { "if-none-match": response.headers.get("etag") ?? "" },
    });
    expect(stylesRoute(request).status).toBe(304);
  });
});
