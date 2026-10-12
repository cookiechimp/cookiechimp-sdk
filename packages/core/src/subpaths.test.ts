import { describe, expect, it } from "vitest";
import { matchService } from "./match";
import { categoriesHash, mergeConfig } from "./sync";

describe("optional core subpaths", () => {
  it("merges and hashes connected configuration", () => {
    const merged = mergeConfig(
      { categories: [{ id: "analytics", label: "Default" }] },
      { categories: [{ id: "analytics", default: true }] },
      { categories: [{ id: "analytics", label: "Override" }] },
    );
    expect(merged.categories[1]).toMatchObject({
      label: "Override",
      default: true,
    });
    expect(categoriesHash(merged)).toMatch(/^[a-z0-9]{7}$/);
    expect(categoriesHash({ categories: ["ads", "analytics"] })).toBe(
      categoriesHash({ categories: ["analytics", "ads"] }),
    );
  });

  it("matches service signals", () => {
    const config = {
      categories: ["analytics"],
      services: [
        {
          id: "demo",
          category: "analytics",
          scripts: ["https://cdn.example/*", /tracker\d+\.js$/],
          cookies: ["_ga*"],
          domains: ["*.metrics.example"],
        },
      ],
    };
    expect(matchService(config, { url: "https://cdn.example/a.js" })).toBe(
      "demo",
    );
    expect(matchService(config, { url: "https://other/tracker12.js" })).toBe(
      "demo",
    );
    expect(matchService(config, { cookieName: "_ga_123" })).toBe("demo");
    expect(matchService(config, { host: "api.metrics.example" })).toBe("demo");
    expect(matchService(config, { host: "example.org" })).toBeNull();
  });
});
