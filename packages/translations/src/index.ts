/** Message identifiers shared by every CookieChimp locale. */
export const messageKeys = [
  "banner.title",
  "banner.description",
  "banner.acceptAll",
  "banner.rejectAll",
  "banner.customize",
  "banner.save",
  "banner.close",
  "preferences.title",
  "preferences.description",
  "category.necessary.name",
  "category.necessary.description",
  "category.functional.name",
  "category.functional.description",
  "category.analytics.name",
  "category.analytics.description",
  "category.marketing.name",
  "category.marketing.description",
  "optOut.label",
  "gpc.honoured",
  "recall.label",
  "gated.placeholder",
  "gated.allow",
] as const;
export type MessageKey = (typeof messageKeys)[number];
export type Messages = Readonly<Record<MessageKey, string>>;
export const rtlLocales = ["ar", "he"] as const;
export type RtlLocale = (typeof rtlLocales)[number];
