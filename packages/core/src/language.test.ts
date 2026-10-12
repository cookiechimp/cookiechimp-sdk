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
  it("matches exact tags, then base languages, then fallback", () => {
    expect(resolveLanguage(["pt-BR"], ["en", "pt", "pt-BR"], "en")).toBe(
      "pt-BR",
    );
    expect(resolveLanguage("fr-CA", ["en", "fr"], "en")).toBe("fr");
    expect(resolveLanguage("xx", ["en", "fr"], "en")).toBe("en");
  });
  it("loads, publishes changes, and exposes text direction", async () => {
    const load = vi.fn(async (locale: string) => ({ locale }));
    const controller = createLanguageController("en", {
      available: ["en", "ar"],
      fallback: "en",
      load,
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    await expect(controller.set("ar-EG")).resolves.toEqual({ locale: "ar" });
    expect(controller.language).toBe("ar");
    expect(controller.dir).toBe("rtl");
    expect(listener).toHaveBeenCalledWith("ar");
  });
  it("throws for invalid options during development", () => {
    expect(() => resolveLanguage("en", [], "en")).toThrow(TypeError);
  });
});
