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

const decode = (value: string) =>
  value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, key: string) => {
      if (!key.startsWith("#")) return NAMED[key.toLowerCase()] ?? match;
      const code =
        key[1]?.toLowerCase() === "x"
          ? Number.parseInt(key.slice(2), 16)
          : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    },
  );

/** Dashboard rich text as plain text: tags removed, entities decoded. */
export const plain = (value: unknown) =>
  typeof value === "string"
    ? decode(
        value
          .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, " "),
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

export interface Span {
  text: string;
  href?: string;
  bold?: boolean;
  italic?: boolean;
}

const BLOCK = /^(p|div|li|ul|ol|h[1-6]|br|tr|table|section)$/;

/**
 * Dashboard rich text as paragraphs of styled spans. Keeps links (http and
 * https only), bold and italic; everything else becomes plain text.
 */
export function rich(value: unknown): Span[][] {
  if (typeof value !== "string" || !value.trim()) return [];
  const paragraphs: Span[][] = [];
  let current: Span[] = [];
  let bold = 0;
  let italic = 0;
  let href: string | undefined;
  const flush = () => {
    const trimmed = current
      .map((span) => ({ ...span, text: span.text.replace(/\s+/g, " ") }))
      .filter((span) => span.text);
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first) first.text = first.text.trimStart();
    if (last) last.text = last.text.trimEnd();
    const kept = trimmed.filter((span) => span.text);
    if (kept.length) paragraphs.push(kept);
    current = [];
  };
  for (const [, close, tag = "", attributes = "", text] of value.matchAll(
    /<(\/?)([a-z][\w-]*)([^>]*)>|([^<]+)/gi,
  )) {
    if (text !== undefined) {
      const span: Span = { text: decode(text) };
      if (bold) span.bold = true;
      if (italic) span.italic = true;
      if (href) span.href = href;
      current.push(span);
      continue;
    }
    const name = tag.toLowerCase();
    if (BLOCK.test(name)) {
      flush();
      if (name === "li" && !close) current.push({ text: "• " });
    } else if (name === "strong" || name === "b") bold += close ? -1 : 1;
    else if (name === "em" || name === "i") italic += close ? -1 : 1;
    else if (name === "a")
      href = close
        ? undefined
        : url(/href\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1]);
    bold = Math.max(0, bold);
    italic = Math.max(0, italic);
  }
  flush();
  return paragraphs;
}

export interface Palette {
  scheme: "light" | "dark";
  background: string;
  heading: string;
  text: string;
  link: string;
  primaryBackground: string;
  primaryText: string;
  secondaryBackground: string;
  secondaryText: string;
  /** Hairlines and outlines, derived from the text color. */
  border: string;
  /** Subtle panels such as category cards, derived from the text color. */
  surface: string;
  /** Switch track when off, derived from the text color. */
  track: string;
  cardRadius: number;
  buttonRadius: number;
  logo?: string;
}

const LIGHT: Palette = {
  scheme: "light",
  background: "#ffffff",
  heading: "#000000",
  text: "#333333",
  link: "#2b2b2b",
  primaryBackground: "#2b2b2b",
  primaryText: "#ffffff",
  secondaryBackground: "#eeeeee",
  secondaryText: "#2b2b2b",
  border: "rgba(51,51,51,0.14)",
  surface: "rgba(51,51,51,0.04)",
  track: "rgba(51,51,51,0.22)",
  cardRadius: 8,
  buttonRadius: 6.4,
};

const DARK: Palette = {
  ...LIGHT,
  scheme: "dark",
  background: "#171a1c",
  heading: "#ffffff",
  text: "#999999",
  link: "#bcbcbc",
  primaryBackground: "#ffffff",
  primaryText: "#333333",
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

/** `color` at the given opacity when it is a hex color, else `color` itself. */
export function alpha(color: string, opacity: number): string {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const full =
    hex.length === 3
      ? [...hex].map((digit) => digit + digit).join("")
      : hex.toLowerCase();
  const [r, g, b] = [0, 2, 4].map((at) =>
    Number.parseInt(full.slice(at, at + 2), 16),
  );
  return `rgba(${r},${g},${b},${opacity})`;
}

/** A dashboard border radius (`8px`, `0.5rem`, `1em`, `12`) in points. */
export function radius(value: unknown, fallback: number): number {
  const match =
    typeof value === "number"
      ? [String(value), String(value), "px"]
      : typeof value === "string"
        ? /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec(value.trim())
        : null;
  if (!match) return fallback;
  const number = Number.parseFloat(match[1] ?? "");
  const points = match[2] === "rem" || match[2] === "em" ? number * 16 : number;
  return Number.isFinite(points) && points >= 0
    ? Math.min(points, 999)
    : fallback;
}

/** Resolve dashboard theme colors, radii and logo for the color scheme. */
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
  result.border = alpha(result.text, 0.16);
  result.surface = alpha(result.text, mode === "dark" ? 0.08 : 0.045);
  result.track = alpha(result.text, 0.28);
  result.cardRadius = radius(theme.modal_border_radius, result.cardRadius);
  result.buttonRadius = radius(theme.btn_border_radius, result.buttonRadius);
  const logo =
    mode === "dark"
      ? (url(theme.logo_url_dark) ?? url(theme.logo_url_light))
      : url(theme.logo_url_light);
  if (logo) result.logo = logo;
  return result;
}
