import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adaptPlatformConfig } from "@cookiechimp/core/sync";
import { describe, expect, it } from "vitest";
import { messages, SDK_LANGUAGES, sdkLanguage } from "./i18n";
import en from "./locales/en";
import { consentText } from "./text";

const bundle = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;

describe("SDK copy", () => {
  it("ships every key in every language, matching the web SDK's locales", async () => {
    const files = readdirSync(resolve(import.meta.dirname, "locales"));
    expect(files.map((file) => file.replace(/\.ts$/, "")).sort()).toEqual(
      [...SDK_LANGUAGES].sort(),
    );
    const { localeMeta } = await import("@cookiechimp/translations/meta");
    expect([...SDK_LANGUAGES].sort()).toEqual(Object.keys(localeMeta).sort());
    for (const language of SDK_LANGUAGES) {
      const { default: locale } = await import(`./locales/${language}.ts`);
      for (const section of ["ui", "data", "purposes"] as const) {
        expect(Object.keys(locale[section]), `${language} ${section}`).toEqual(
          Object.keys(en[section]),
        );
        for (const text of Object.values(locale[section]) as string[]) {
          expect(text.trim(), `${language} ${section}`).not.toBe("");
          expect(text).not.toContain("\u2014");
        }
      }
      expect(locale.ui.poweredBy).toContain("{name}");
    }
  });

  it("matches language tags to the closest built-in locale", () => {
    expect(sdkLanguage("de")).toBe("de");
    expect(sdkLanguage("de-AT")).toBe("de");
    expect(sdkLanguage("pt-br")).toBe("pt-BR");
    expect(sdkLanguage("pt_BR")).toBe("pt-BR");
    expect(sdkLanguage("pt-PT")).toBe("pt");
    expect(sdkLanguage("nb-NO")).toBe("no");
    expect(sdkLanguage("zh-Hant-TW")).toBe("zh");
    expect(sdkLanguage("is")).toBeUndefined();
    expect(sdkLanguage(undefined)).toBeUndefined();
  });

  it("falls back to English for languages without built-in copy", () => {
    const icelandic = messages("is");
    expect(icelandic.language).toBeUndefined();
    expect(icelandic.ui.acceptAll).toBe("Accept all");
    expect(icelandic.has("acceptAll")).toBe(false);
    expect(messages("de").has("acceptAll")).toBe(true);
  });

  it("lets the app replace any string, then uses the built-in copy", () => {
    const copy = messages("de-CH", {
      "de-CH": { ui: { title: "Ihre Daten" } },
      de: { ui: { save: "Sichern", title: "unused" }, data: { device_id: "" } },
      is: { ui: { title: "Persónuvernd" } },
    });
    expect(copy.ui.title).toBe("Ihre Daten");
    expect(copy.ui.save).toBe("Sichern");
    expect(copy.ui.close).toBe("Schließen");
    // A blank override does not hide the built-in copy.
    expect(copy.dataType("device_id")).toBe("Geräte-ID");
    expect(
      messages("is", { is: { ui: { title: "Persónuvernd" } } }).ui.title,
    ).toBe("Persónuvernd");
  });

  it("labels data types and purposes, including keys it does not know", () => {
    const french = messages("fr");
    expect(french.dataType("crash_data")).toBe("Données de plantage");
    expect(french.purpose("analytics")).toBe("Analyse");
    expect(french.dataType("voice_prints")).toBe("Voice prints");
    expect(french.dataType("toString")).toBe("ToString");
  });
});

type Bundle = {
  banners: Record<string, Record<string, unknown>>;
  translations: Record<
    string,
    Record<string, Record<string, Record<string, unknown>>>
  >;
};

const dashboard = (
  change: (value: Bundle) => void,
  options: { locale?: string; region?: string } = { region: "DE" },
) => {
  const value = structuredClone(bundle) as unknown as Bundle;
  change(value);
  const config = adaptPlatformConfig(value, options);
  if (!config) throw new Error("invalid fixture");
  return config;
};

describe("dashboard copy fallbacks", () => {
  it("uses the dashboard copy in the selected language first", () => {
    const text = consentText(
      dashboard(() => {}, { region: "DE", locale: "de" }),
    );
    const german = bundle.translations as Bundle["translations"];
    expect(text.language).toBe("de");
    expect(text.banner.title).toBe(
      german.bnrEU1?.de?.consent_modal?.title as string,
    );
  });

  it("fills a missing field with SDK copy in the same language", () => {
    const config = dashboard(
      (value) => {
        const copy = value.translations.bnrEU1?.de;
        if (!copy) throw new Error("fixture has no German copy");
        copy.consent_modal = {
          ...copy.consent_modal,
          accept_btn: "",
          title: " ",
        };
        copy.preferences_modal = {
          ...copy.preferences_modal,
          save_btn: undefined,
          accept_btn: "",
        };
      },
      { region: "DE", locale: "de" },
    );
    const text = consentText(config, { locale: "de-DE" });
    expect(text.banner.acceptAll).toBe("Alle akzeptieren");
    expect(text.banner.title).toBe("Datenschutzeinstellungen");
    expect(text.preferences.save).toBe("Einstellungen speichern");
    expect(text.preferences.acceptAll).toBe("Alle akzeptieren");
    expect(text.messages.ui.dataCollected).toBe("Erhobene Daten");
  });

  it("uses the default language's dashboard copy when the SDK has no copy for the language", () => {
    const config = dashboard(
      (value) => {
        const banner = value.banners.bnrEU1 as Record<string, unknown>;
        banner.available_languages = ["en", "is"];
        const english = value.translations.bnrEU1?.en;
        if (!english) throw new Error("fixture has no English copy");
        value.translations.bnrEU1 = {
          ...value.translations.bnrEU1,
          is: {
            consent_modal: { title: "Persónuvernd", accept_btn: "" },
            preferences_modal: {},
          },
        };
      },
      { region: "DE", locale: "is" },
    );
    const text = consentText(config, { locale: "is" });
    expect(text.language).toBe("is");
    expect(text.banner.title).toBe("Persónuvernd");
    expect(text.banner.acceptAll).toBe("Accept All");
    expect(text.preferences.save).toBe("Save Preferences");
    // Optional paragraphs are never borrowed from another language.
    expect(text.banner.additionalDescription).toBeUndefined();
    expect(text.preferences.moreInfo).toBeUndefined();
  });

  it("refines the dashboard language with the device locale for SDK copy", () => {
    const config = dashboard(
      (value) => {
        const banner = value.banners.bnrEU1 as Record<string, unknown>;
        banner.available_languages = ["pt"];
        value.translations.bnrEU1 = {
          pt: {
            consent_modal: { title: "Privacidade" },
            preferences_modal: {},
          },
        };
      },
      { region: "DE", locale: "pt-BR" },
    );
    expect(consentText(config, { locale: "pt-BR" }).banner.rejectAll).toBe(
      "Recusar opcionais",
    );
    expect(consentText(config, { locale: "en-US" }).banner.rejectAll).toBe(
      "Rejeitar opcionais",
    );
  });

  it("marks right-to-left languages", () => {
    const config = dashboard(
      (value) => {
        const banner = value.banners.bnrEU1 as Record<string, unknown>;
        banner.available_languages = ["ar"];
        value.translations.bnrEU1 = {
          ar: { consent_modal: {}, preferences_modal: {} },
        };
      },
      { region: "DE", locale: "ar" },
    );
    const text = consentText(config, { locale: "ar" });
    expect(text.rtl).toBe(true);
    expect(text.banner.acceptAll).toBe("قبول الكل");
  });
});
