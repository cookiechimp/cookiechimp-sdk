import ar from "./locales/ar";
import bg from "./locales/bg";
import cs from "./locales/cs";
import da from "./locales/da";
import de from "./locales/de";
import el from "./locales/el";
import en from "./locales/en";
import es from "./locales/es";
import et from "./locales/et";
import fi from "./locales/fi";
import fr from "./locales/fr";
import ga from "./locales/ga";
import he from "./locales/he";
import hr from "./locales/hr";
import hu from "./locales/hu";
import it from "./locales/it";
import ja from "./locales/ja";
import ko from "./locales/ko";
import lt from "./locales/lt";
import lv from "./locales/lv";
import mt from "./locales/mt";
import nl from "./locales/nl";
import no from "./locales/no";
import pl from "./locales/pl";
import pt from "./locales/pt";
import ptBR from "./locales/pt-BR";
import ro from "./locales/ro";
import sk from "./locales/sk";
import sl from "./locales/sl";
import sv from "./locales/sv";
import tr from "./locales/tr";
import uk from "./locales/uk";
import zh from "./locales/zh";

/** Interface copy the SDK draws itself, and fallbacks for dashboard copy. */
export type UiKey =
  | "title"
  | "description"
  | "acceptAll"
  | "rejectAll"
  | "customize"
  | "close"
  | "privacyPolicy"
  | "preferencesTitle"
  | "preferencesDescription"
  | "save"
  | "consentId"
  | "poweredBy"
  | "dataCollected"
  | "usedFor"
  | "tracking"
  | "retention"
  | "packages"
  | "yes"
  | "no"
  | "type"
  | "duration"
  | "company";

/** Data type keys from the app store privacy labels. */
export type DataTypeKey = keyof typeof en.data;
/** Purpose keys from the app store privacy labels. */
export type PurposeKey = keyof typeof en.purposes;

export interface LocaleMessages {
  ui: Record<UiKey, string>;
  data: Record<string, string>;
  purposes: Record<string, string>;
}

/**
 * Your own copy for the SDK's interface, by language. Any key you leave out
 * uses the built-in translation, then English.
 *
 * @example { de: { ui: { title: "Ihre Privatsphäre" } } }
 */
export type Translations = Readonly<
  Record<
    string,
    {
      ui?: Partial<Record<UiKey, string>>;
      data?: Partial<Record<string, string>>;
      purposes?: Partial<Record<string, string>>;
    }
  >
>;

const LOCALES: Readonly<Record<string, LocaleMessages>> = {
  ar,
  bg,
  cs,
  da,
  de,
  el,
  en,
  es,
  et,
  fi,
  fr,
  ga,
  he,
  hr,
  hu,
  it,
  ja,
  ko,
  lt,
  lv,
  mt,
  nl,
  no,
  pl,
  pt,
  "pt-BR": ptBR,
  ro,
  sk,
  sl,
  sv,
  tr,
  uk,
  zh,
};

/** Languages with built-in SDK copy. */
export const SDK_LANGUAGES: readonly string[] = Object.keys(LOCALES);

// Norwegian Bokmål and Nynorsk share the Norwegian copy.
const ALIASES: Record<string, string> = { nb: "no", nn: "no" };

const own = <T>(record: Readonly<Record<string, T>>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * The built-in locale for a language tag, for example `pt-BR` for `pt-br`,
 * `de` for `de-AT` and `zh` for `zh-Hant`. Undefined when none matches.
 */
export function sdkLanguage(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  const value = tag.trim().replaceAll("_", "-");
  const exact = SDK_LANGUAGES.find(
    (code) => code.toLowerCase() === value.toLowerCase(),
  );
  if (exact) return exact;
  const base = value.split("-")[0]?.toLowerCase() ?? "";
  return own(LOCALES, base) ? base : own(ALIASES, base);
}

export interface Messages {
  /** The built-in locale used, or undefined when only English was available. */
  language: string | undefined;
  /** Interface copy in the language, falling back to English per key. */
  ui: Readonly<Record<UiKey, string>>;
  /** A data type label; unknown keys become readable text. */
  dataType(key: string): string;
  /** A purpose label; unknown keys become readable text. */
  purpose(key: string): string;
  /** True when `key` has copy in the language itself, not only in English. */
  has(key: UiKey): boolean;
}

const readable = (key: string) =>
  key.replace(/[_-]+/g, " ").replace(/^./, (first) => first.toUpperCase());

/**
 * SDK copy for a language. Your `translations` win, then the built-in copy for
 * the language, then English, so a missing key never shows up blank.
 */
export function messages(
  tag: string | undefined,
  translations: Translations = {},
): Messages {
  const language = sdkLanguage(tag);
  const value = tag?.trim().replaceAll("_", "-") ?? "";
  // App copy for the exact tag, then its base language.
  const custom = [
    own(translations, value),
    own(translations, value.split("-")[0] ?? ""),
  ].filter((item) => item !== undefined);
  const builtIn = language ? own(LOCALES, language) : undefined;
  const pick = (
    section: "ui" | "data" | "purposes",
    key: string,
  ): string | undefined => {
    for (const source of [...custom, builtIn]) {
      const text = source?.[section]
        ? own(source[section] as Record<string, unknown>, key)
        : undefined;
      if (typeof text === "string" && text.trim()) return text;
    }
    return undefined;
  };
  const ui = Object.fromEntries(
    (Object.keys(en.ui) as UiKey[]).map((key) => [
      key,
      pick("ui", key) ?? en.ui[key],
    ]),
  ) as Record<UiKey, string>;
  const english = (section: "data" | "purposes", key: string) =>
    own(en[section] as Record<string, string>, key) ?? readable(key);
  return {
    language,
    ui,
    dataType: (key) => pick("data", key) ?? english("data", key),
    purpose: (key) => pick("purposes", key) ?? english("purposes", key),
    has: (key) => pick("ui", key) !== undefined,
  };
}
