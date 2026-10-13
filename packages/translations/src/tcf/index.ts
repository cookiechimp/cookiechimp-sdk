/**
 * TCF vendor UI labels. Opt-in: import a locale from
 * `@cookiechimp/translations/tcf/<locale>` and pass it to `TcfVendorList` as
 * `labels`. The core per-locale bundles do not include these strings.
 */
export const tcfMessageKeys = [
  "title",
  "purposes",
  "specialFeatures",
  "vendors",
  "search",
  "consent",
  "legitimateInterest",
  "acceptAll",
  "rejectAll",
  "save",
  "saved",
  "empty",
  "details",
  "close",
  "consentPurposes",
  "legIntPurposes",
  "specialPurposes",
  "features",
  "dataCategories",
  "retention",
  "retentionDays",
  "standardRetention",
  "privacyPolicy",
  "legIntClaim",
  "storage",
  "cookieMaxAge",
  "cookieSession",
  "cookieRefresh",
  "noCookies",
  "nonCookieAccess",
  "storageDisclosure",
] as const;
export type TcfMessageKey = (typeof tcfMessageKeys)[number];
export type TcfMessages = Readonly<Record<TcfMessageKey, string>>;
/** Locales whose TCF labels have had native-speaker review. */
export const tcfReviewedLocales = ["en"] as const;
