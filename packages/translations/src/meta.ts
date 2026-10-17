/** Editorial review of SDK UI copy, recorded separately from certification. */
export const translationReview = {
  reviewer: "Codex",
  method: "ai-editorial",
  reviewedAt: "2026-10-17",
} as const;

export const localeMeta = {
  en: { reviewed: true, dir: "ltr" },
  de: { reviewed: true, dir: "ltr" },
  fr: { reviewed: true, dir: "ltr" },
  es: { reviewed: true, dir: "ltr" },
  it: { reviewed: true, dir: "ltr" },
  nl: { reviewed: true, dir: "ltr" },
  pt: { reviewed: true, dir: "ltr" },
  "pt-BR": { reviewed: true, dir: "ltr" },
  pl: { reviewed: true, dir: "ltr" },
  sv: { reviewed: true, dir: "ltr" },
  da: { reviewed: true, dir: "ltr" },
  fi: { reviewed: true, dir: "ltr" },
  no: { reviewed: true, dir: "ltr" },
  cs: { reviewed: true, dir: "ltr" },
  sk: { reviewed: true, dir: "ltr" },
  hu: { reviewed: true, dir: "ltr" },
  ro: { reviewed: true, dir: "ltr" },
  bg: { reviewed: true, dir: "ltr" },
  el: { reviewed: true, dir: "ltr" },
  hr: { reviewed: true, dir: "ltr" },
  sl: { reviewed: true, dir: "ltr" },
  et: { reviewed: true, dir: "ltr" },
  lv: { reviewed: true, dir: "ltr" },
  lt: { reviewed: true, dir: "ltr" },
  ga: { reviewed: true, dir: "ltr" },
  mt: { reviewed: true, dir: "ltr" },
  tr: { reviewed: true, dir: "ltr" },
  ja: { reviewed: true, dir: "ltr" },
  zh: { reviewed: true, dir: "ltr" },
  ko: { reviewed: true, dir: "ltr" },
  ar: { reviewed: true, dir: "rtl" },
  he: { reviewed: true, dir: "rtl" },
  uk: { reviewed: true, dir: "ltr" },
} as const satisfies Record<string, { reviewed: boolean; dir: "ltr" | "rtl" }>;

export type Locale = keyof typeof localeMeta;
