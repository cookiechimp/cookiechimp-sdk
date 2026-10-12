export interface LanguageSource {
  readonly language?: string;
}

export interface LanguageControllerOptions<Messages = unknown> {
  available: readonly string[];
  fallback: string;
  load?: (locale: string) => Promise<Messages>;
}

export interface LanguageController<Messages = unknown> {
  readonly language: string;
  readonly dir: "ltr" | "rtl";
  set(language: string): Promise<Messages | undefined>;
  subscribe(listener: (language: string) => void): () => void;
}

const localePattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

function canonical(locale: string): string | undefined {
  const value = locale.trim().replaceAll("_", "-");
  if (!localePattern.test(value)) return undefined;
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

function invalid(message: string): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(message);
  console.warn(message);
}

/** Parse an Accept-Language value in descending preference order. */
export function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [raw = "", ...parameters] = part.trim().split(";");
      const language = canonical(raw);
      let quality = 1;
      for (const parameter of parameters) {
        const match = /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(
          parameter.trim(),
        );
        if (match) quality = Number(match[1]);
      }
      return { language, quality, index };
    })
    .filter(
      (item): item is { language: string; quality: number; index: number } =>
        item.language !== undefined && item.quality > 0,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ language }) => language);
}

/** Resolve explicit, browser, or HTTP language candidates against supported locales. */
export function resolveLanguage(
  candidates: string | readonly string[] | null | undefined,
  available: readonly string[],
  fallback: string,
): string {
  const supported = available.map((value) => ({
    value,
    tag: canonical(value),
  }));
  const fallbackMatch = supported.find(
    ({ tag }) => tag?.toLowerCase() === canonical(fallback)?.toLowerCase(),
  );
  if (supported.length === 0 || !fallbackMatch) {
    invalid(
      "CookieChimp language options require a non-empty available list containing fallback",
    );
    return fallback;
  }
  const requested = Array.isArray(candidates)
    ? candidates
    : typeof candidates === "string"
      ? candidates.includes(",") || candidates.includes(";")
        ? parseAcceptLanguage(candidates)
        : [candidates]
      : [];
  for (const candidate of requested) {
    const tag = canonical(candidate);
    if (!tag) continue;
    const exact = supported.find(
      ({ tag: availableTag }) =>
        availableTag?.toLowerCase() === tag.toLowerCase(),
    );
    if (exact) return exact.value;
    const base = tag.split("-")[0]?.toLowerCase();
    const baseMatch = supported.find(
      ({ tag: availableTag }) => availableTag?.toLowerCase() === base,
    );
    if (baseMatch) return baseMatch.value;
  }
  return fallbackMatch.value;
}

/** Create an independent, subscribable language selector. */
export function createLanguageController<Messages = unknown>(
  source: LanguageSource | string | undefined,
  options: LanguageControllerOptions<Messages>,
): LanguageController<Messages> {
  let language = resolveLanguage(
    typeof source === "string" ? source : source?.language,
    options.available,
    options.fallback,
  );
  const listeners = new Set<(language: string) => void>();
  return {
    get language() {
      return language;
    },
    get dir() {
      return /^(ar|he)(-|$)/i.test(language) ? "rtl" : "ltr";
    },
    async set(candidate) {
      const next = resolveLanguage(
        candidate,
        options.available,
        options.fallback,
      );
      const messages = await options.load?.(next);
      if (next !== language) {
        language = next;
        for (const listener of [...listeners]) listener(language);
      }
      return messages;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
