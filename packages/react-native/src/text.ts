import type { DashboardConfig } from "@cookiechimp/core/sync";
import { type Messages, messages, type Translations } from "./i18n";
import {
  object,
  plain,
  poweredBy,
  rich,
  url,
  withoutBranding,
} from "./presentation";

/** Every piece of copy the consent screens show, with fallbacks applied. */
export interface ConsentText {
  /** Dashboard language of the copy, for example `de`. */
  language: string;
  /** Right-to-left layout for the language. */
  rtl: boolean;
  banner: {
    title: string;
    /** Dashboard rich text (HTML). Render it with `richText`. */
    description: string;
    additionalDescription?: string;
    acceptAll: string;
    rejectAll: string;
    customize: string;
    close: string;
    /** Footer rich text without the "Powered by" link, if any. */
    footer?: string;
    /** Show "Powered by CookieChimp" in the banner (Free and Basic plans). */
    poweredBy: boolean;
  };
  preferences: {
    title: string;
    description: string;
    acceptAll: string;
    rejectAll: string;
    save: string;
    close: string;
    moreInfoTitle?: string;
    moreInfo?: string;
  };
  privacyPolicyUrl?: string;
  /** SDK interface copy and data label names in the same language. */
  messages: Messages;
}

const RTL_FALLBACK = ["ar", "fa", "he", "ur"];

type Section = "consent_modal" | "preferences_modal";

/**
 * Resolve the consent copy. Each value comes from the dashboard copy in the
 * selected language, then the SDK's own copy in that language, then the
 * dashboard copy in the banner's default language, then English. Optional
 * copy (additional description, more info, footer) only comes from the
 * selected language.
 */
export function consentText(
  dashboard: DashboardConfig,
  options: { locale?: string; translations?: Translations } = {},
): ConsentText {
  const language = dashboard.language;
  const base = (tag: string | undefined) =>
    tag?.split("-")[0]?.toLowerCase() ?? "";
  // A device locale such as pt-BR refines the dashboard's `pt` copy.
  const tag =
    options.locale && (!language || base(options.locale) === base(language))
      ? options.locale
      : language || options.locale;
  const sdk = messages(tag, options.translations);
  const fallbackLanguage = (
    Array.isArray(dashboard.banner.available_languages)
      ? dashboard.banner.available_languages
      : []
  ).find((code): code is string => typeof code === "string");
  const fallbackCopy =
    fallbackLanguage && fallbackLanguage !== language
      ? object(object(dashboard.translations)[fallbackLanguage])
      : {};
  const current = (section: Section) => object(dashboard.copy[section]);
  const fallback = (section: Section) => object(fallbackCopy[section]);
  const has = (value: unknown, kind: "plain" | "rich") =>
    kind === "plain" ? !!plain(value) : rich(value).length > 0;
  const read = (
    sources: [Section, string][],
    key: keyof Messages["ui"] | null,
    kind: "plain" | "rich" = "plain",
  ): string | undefined => {
    const format = (value: unknown) =>
      kind === "plain" ? plain(value) : String(value);
    for (const [section, field] of sources) {
      const value = current(section)[field];
      if (has(value, kind)) return format(value);
    }
    // Optional copy such as "more info" is never borrowed from another language.
    if (!key) return undefined;
    if (sdk.has(key)) return sdk.ui[key];
    for (const [section, field] of sources) {
      const value = fallback(section)[field];
      if (has(value, kind)) return format(value);
    }
    return sdk.ui[key];
  };
  const banner = (field: string): [Section, string] => ["consent_modal", field];
  const prefs = (field: string): [Section, string] => [
    "preferences_modal",
    field,
  ];
  const footer = object(dashboard.banner.footer);
  const footerContent = withoutBranding(
    current("consent_modal").footer ?? footer.content,
  );
  const rtlBase = base(language || tag);
  return {
    language,
    rtl: (dashboard.rtlLanguages ?? RTL_FALLBACK).includes(rtlBase),
    banner: {
      title: read([banner("title")], "title") as string,
      description: read([banner("description")], "description", "rich") ?? "",
      additionalDescription: read(
        [banner("additional_description")],
        null,
        "rich",
      ),
      acceptAll: read([banner("accept_btn")], "acceptAll") as string,
      rejectAll: read([banner("reject_btn")], "rejectAll") as string,
      customize: read([banner("preferences_btn")], "customize") as string,
      close: read([banner("close_btn")], "close") as string,
      footer:
        footer.enabled !== false && rich(footerContent).length
          ? String(footerContent)
          : undefined,
      poweredBy: poweredBy(dashboard.banner),
    },
    preferences: {
      title: read([prefs("title")], "preferencesTitle") as string,
      description:
        read([prefs("description")], "preferencesDescription", "rich") ?? "",
      acceptAll: read(
        [prefs("accept_btn"), banner("accept_btn")],
        "acceptAll",
      ) as string,
      rejectAll: read(
        [prefs("reject_btn"), banner("reject_btn")],
        "rejectAll",
      ) as string,
      save: read([prefs("save_btn")], "save") as string,
      close: read([prefs("close_btn")], "close") as string,
      moreInfoTitle: read([prefs("more_info_title")], null),
      moreInfo: read([prefs("more_info")], null, "rich"),
    },
    privacyPolicyUrl:
      url(dashboard.copy.privacy_policy_url) ??
      url(fallbackCopy.privacy_policy_url),
    messages: sdk,
  };
}
