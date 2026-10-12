import { describe, expect, it } from "vitest";
import { normalizeConfig } from "./config";
import { matchService } from "./match";

const config = {
  categories: ["analytics"],
  services: [
    {
      id: "metrics",
      category: "analytics",
      scripts: ["https://cdn.example/*/tracker.js", /collector\d+\.js$/],
      cookies: ["_ga*", "session_id"],
      domains: ["*.metrics.example", "EXACT.example"],
    },
  ],
} as const;

describe("matchService", () => {
  it.each([
    [{ url: "https://cdn.example/v2/tracker.js" }, "script wildcard"],
    [{ url: "https://elsewhere.example/collector42.js" }, "script RegExp"],
    [{ cookieName: "_ga_ABC" }, "cookie wildcard"],
    [{ cookieName: "session_id" }, "cookie exact pattern"],
    [{ host: "api.metrics.example" }, "host wildcard"],
    [{ host: "exact.EXAMPLE" }, "case-insensitive host pattern"],
  ])("matches a service signal", (target, _description) => {
    expect(matchService(config, target)).toBe("metrics");
  });

  it("returns null when no configured signal matches", () => {
    expect(
      matchService(config, {
        url: "https://cdn.example/tracker.css",
        cookieName: "unrelated",
        host: "example.org",
      }),
    ).toBeNull();
    expect(matchService(config, {})).toBeNull();
  });

  it("compiles patterns only once for a normalized config", () => {
    let sourceReads = 0;
    class ObservedRegExp extends RegExp {
      override get source(): string {
        sourceReads += 1;
        return super.source;
      }
    }
    const normalized = normalizeConfig({
      categories: ["analytics"],
      services: [
        {
          id: "observed",
          category: "analytics",
          scripts: [new ObservedRegExp("tracker\\.js$")],
        },
      ],
    });

    expect(matchService(normalized, { url: "https://one/tracker.js" })).toBe(
      "observed",
    );
    const readsAfterCompilation = sourceReads;
    expect(readsAfterCompilation).toBeGreaterThan(0);
    expect(matchService(normalized, { url: "https://two/tracker.js" })).toBe(
      "observed",
    );
    expect(sourceReads).toBe(readsAfterCompilation);
  });
});
