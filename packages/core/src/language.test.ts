import { describe, expect, it, vi } from "vitest";
import {
  createLanguageController,
  parseAcceptLanguage,
  resolveLanguage,
} from "./language";

describe("language resolution", () => {
  it("sorts Accept-Language entries by q-value", () => {
    expect(parseAcceptLanguage("fr-CA;q=0.8, de;q=1, en;q=0")).toEqual([
      "de",
      "fr-CA",
    ]);
  });
  it("drops invalid q-values and ignores malformed language input", () => {
    expect(parseAcceptLanguage("de;q=abc, fr;q=0.8")).toEqual(["fr"]);
    expect(parseAcceptLanguage("de;q=2, fr;q=0.8")).toEqual(["fr"]);
    expect(parseAcceptLanguage("de;q=-0.1, fr;q=0.8")).toEqual(["fr"]);
    expect(parseAcceptLanguage("de;q=0.1234, fr;q=0.8")).toEqual(["fr"]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage("*")).toEqual([]);
    expect(parseAcceptLanguage(";;,,")).toEqual([]);
    expect(parseAcceptLanguage("fr_CA, DE-de, i-klingon")).toEqual([
      "fr-CA",
      "de-DE",
    ]);
    expect(parseAcceptLanguage(`${"x".repeat(10_000)},fr`)).toEqual(["fr"]);
  });
  it("matches exact tags, then base languages, then fallback", () => {
    expect(resolveLanguage(["pt-BR"], ["en", "pt", "pt-BR"], "en")).toBe(
      "pt-BR",
    );
    expect(resolveLanguage("fr-CA", ["en", "fr"], "en")).toBe("fr");
    expect(resolveLanguage("fr-CA", ["en", "fr-FR", "fr-BE"], "en")).toBe(
      "fr-FR",
    );
    expect(resolveLanguage("pt", ["en", "pt-BR"], "en")).toBe("pt-BR");
    expect(resolveLanguage("xx", ["en", "fr"], "en")).toBe("en");
  });
  it("loads, publishes changes, and exposes text direction", async () => {
    const load = vi.fn(async (locale: string) => ({ locale }));
    const controller = createLanguageController("en", {
      available: ["en", "ar"],
      fallback: "en",
      load,
      rtl: ["ar", "he"],
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    await expect(controller.set("ar-EG")).resolves.toEqual({ locale: "ar" });
    expect(controller.language).toBe("ar");
    expect(controller.dir).toBe("rtl");
    expect(listener).toHaveBeenCalledWith("ar");
  });
  it("uses the supplied RTL locale list for Arabic and Hebrew", () => {
    for (const language of ["ar", "he-IL"]) {
      const controller = createLanguageController(language, {
        available: ["en", "ar", "he"],
        fallback: "en",
        rtl: ["ar", "he"],
      });
      expect(controller.dir).toBe("rtl");
    }
  });
  it("throws for invalid options during development", () => {
    expect(() => resolveLanguage("en", [], "en")).toThrow(TypeError);
  });
});
