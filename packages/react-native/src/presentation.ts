export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Dashboard rich text as plain text: tags removed, entities decoded. */
export const plain = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(
          /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
          (match, key: string) => {
            if (!key.startsWith("#")) return NAMED[key.toLowerCase()] ?? match;
            const code =
              key[1]?.toLowerCase() === "x"
                ? Number.parseInt(key.slice(2), 16)
                : Number(key.slice(1));
            return code > 0 &&
              code <= 0x10ffff &&
              !(code >= 0xd800 && code <= 0xdfff)
              ? String.fromCodePoint(code)
              : "";
          },
        )
        .replace(/[ \t\f\r]+/g, " ")
        .replace(/ ?\n ?/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim()
    : "";

/** An http(s) URL without credentials, safe to open with Linking. */
export function url(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  return /^https?:\/\/[^\s/@]+(?:[/?#][^\s]*)?$/i.test(value.trim())
    ? value.trim()
    : undefined;
}

export interface Palette {
  background: string;
  heading: string;
  text: string;
  link: string;
  primaryBackground: string;
  primaryText: string;
  secondaryBackground: string;
  secondaryText: string;
  cardRadius: number;
  buttonRadius: number;
}

const LIGHT: Palette = {
  background: "#ffffff",
  heading: "#111111",
  text: "#333333",
  link: "#2b2b2b",
  primaryBackground: "#2b2b2b",
  primaryText: "#ffffff",
  secondaryBackground: "#ffffff",
  secondaryText: "#2b2b2b",
  cardRadius: 12,
  buttonRadius: 8,
};

const DARK: Palette = {
  ...LIGHT,
  background: "#171a1c",
  heading: "#ffffff",
  text: "#c4c4c4",
  link: "#e0e0e0",
  primaryBackground: "#ffffff",
  primaryText: "#171a1c",
  secondaryBackground: "#171a1c",
  secondaryText: "#ffffff",
};

const COLOR = /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i;
const KEYS: Record<string, keyof Palette> = {
  bg: "background",
  heading_color: "heading",
  text_color: "text",
  link_color: "link",
  btn_primary_bg: "primaryBackground",
  btn_primary_color: "primaryText",
  btn_secondary_bg: "secondaryBackground",
  btn_secondary_color: "secondaryText",
};

const radius = (value: unknown, fallback: number) => {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\.\d+)?(?:px)?$/.test(value)
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(number) && number >= 0 && number <= 64
    ? number
    : fallback;
};

/** Resolve dashboard theme colors for the current color scheme. */
export function palette(
  theme: Record<string, unknown>,
  scheme: string | null | undefined,
): Palette {
  const mode =
    theme.dark_mode === true || theme.dark_mode === "dark"
      ? "dark"
      : theme.dark_mode === "auto"
        ? scheme === "dark"
          ? "dark"
          : "light"
        : "light";
  const result = { ...(mode === "dark" ? DARK : LIGHT) };
  const colors = object(mode === "dark" ? theme.dark_colors : theme.colors);
  for (const [key, target] of Object.entries(KEYS)) {
    const value = colors[key];
    if (typeof value === "string" && COLOR.test(value))
      (result as Record<string, string | number>)[target] = value;
  }
  result.cardRadius = radius(theme.modal_border_radius, result.cardRadius);
  result.buttonRadius = radius(theme.btn_border_radius, result.buttonRadius);
  return result;
}
