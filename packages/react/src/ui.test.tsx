import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookieBanner } from "./banner";

afterEach(() => vi.restoreAllMocks());

describe("styled prop validation", () => {
  it("throws for invalid props in development", () => {
    expect(() =>
      renderToStaticMarkup(<CookieBanner position={"side" as "bottom"} />),
    ).toThrow("Invalid CookieBanner props");
  });

  it("warns and uses a safe fallback in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      renderToStaticMarkup(<CookieBanner position={"side" as "bottom"} />),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("position"));
    vi.unstubAllEnvs();
  });
});
