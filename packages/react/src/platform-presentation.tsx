import { type CSSProperties, createElement, type ReactNode } from "react";

export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const plain = (value: unknown) =>
  typeof value === "string"
    ? decode(value.replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim()
    : "";
function decode(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, key: string) => {
      if (!key.startsWith("#")) return named[key.toLowerCase()] ?? match;
      const code =
        key[1]?.toLowerCase() === "x"
          ? Number.parseInt(key.slice(2), 16)
          : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    },
  );
}
export function url(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return !parsed.username &&
      !parsed.password &&
      ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
function link(value: string) {
  const decoded = decode(value).trim();
  return (
    url(decoded) ??
    (/^(mailto:|tel:|\/(?!\/)|#)/i.test(decoded) ? decoded : undefined)
  );
}

// Build React elements from an explicit formatting allowlist. No dashboard HTML
// or attributes are ever passed to the DOM, so SSR and hydration use the same tree.
export function RichText({
  value,
  omitBranding = false,
}: {
  value: unknown;
  omitBranding?: boolean;
}) {
  if (typeof value !== "string") return null;
  type Node = { tag: string; href?: string; children: (Node | string)[] };
  const root: Node = { tag: "div", children: [] };
  const stack = [root];
  const allowed = new Set([
    "p",
    "div",
    "span",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
  ]);
  let blocked = "";
  for (const token of value
    .slice(0, 65536)
    .match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g) ?? []) {
    const tag = /^<\s*(\/?)\s*([a-z][\w-]*)\b/i.exec(token);
    if (blocked) {
      if (tag?.[1] && tag[2]?.toLowerCase() === blocked) blocked = "";
      continue;
    }
    if (tag) {
      const name = tag[2]?.toLowerCase() ?? "";
      if (
        ["script", "style", "iframe", "object", "svg", "math"].includes(name) &&
        !tag[1]
      ) {
        blocked = name;
        continue;
      }
      if (!allowed.has(name)) continue;
      if (tag[1]) {
        const index = stack.map((node) => node.tag).lastIndexOf(name);
        if (index > 0) stack.splice(index);
      } else {
        const href =
          name === "a"
            ? /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(token)
            : null;
        if (
          omitBranding &&
          href &&
          /^https?:\/\/(?:www\.)?cookiechimp\.com\/?(?:[?#].*)?$/.test(
            decode(href[1] ?? href[2] ?? href[3] ?? ""),
          )
        ) {
          blocked = "a";
          continue;
        }
        const node: Node = {
          tag: name,
          children: [],
          href: href ? link(href[1] ?? href[2] ?? href[3] ?? "") : undefined,
        };
        stack.at(-1)?.children.push(node);
        if (name !== "br" && !token.endsWith("/>")) stack.push(node);
      }
    } else if (!token.startsWith("<!--"))
      stack.at(-1)?.children.push(decode(token));
  }
  const render = (nodes: (Node | string)[], depth = 0): ReactNode =>
    depth > 40
      ? null
      : nodes.map((node, index) =>
          typeof node === "string"
            ? node
            : createElement(
                node.tag === "a" && !node.href ? "span" : node.tag,
                {
                  key: index,
                  ...(node.href
                    ? {
                        href: node.href,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {}),
                },
                ...(node.tag === "br"
                  ? []
                  : [render(node.children, depth + 1)]),
              ),
        );
  return render(root.children);
}

export const themeMode = (theme: Record<string, unknown>) =>
  theme.dark_mode === true || theme.dark_mode === "dark"
    ? "dark"
    : theme.dark_mode === "auto"
      ? "auto"
      : "light";
export function themeStyle(theme: Record<string, unknown>): CSSProperties {
  const style: Record<string, string> = {};
  const names: Record<string, string> = {
    bg: "bg",
    heading_color: "heading",
    text_color: "text",
    link_color: "link",
    btn_primary_bg: "btn-primary-bg",
    btn_primary_color: "btn-primary-color",
    btn_secondary_bg: "btn-secondary-bg",
    btn_secondary_color: "btn-secondary-color",
  };
  for (const [mode, colors] of [
    ["light", object(theme.colors)],
    ["dark", object(theme.dark_colors)],
  ] as const) {
    for (const [key, token] of Object.entries(names)) {
      const value = colors[key];
      if (
        typeof value === "string" &&
        /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(value)
      )
        style[`--cc-platform-${mode}-${token}`] = value;
    }
  }
  for (const [key, token] of [
    ["modal_border_radius", "card"],
    ["btn_border_radius", "button"],
  ] as const) {
    const value = theme[key];
    if (
      typeof value === "string" &&
      /^\d+(?:\.\d{1,4})?(?:px|em|rem|%)$/.test(value)
    )
      style[`--cc-radius-${token}`] = value;
    else if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      style[`--cc-radius-${token}`] = `${value}px`;
  }
  return style as CSSProperties;
}
export function Logo({ theme }: { theme: Record<string, unknown> }) {
  const light = url(theme.logo_url_light) ?? url(theme.logo_url_dark);
  const dark = url(theme.logo_url_dark) ?? light;
  if (!light) return null;
  return (
    <span className="cc-platform-logo">
      <img className="cc-platform-logo-light" src={light} alt="" />
      <img className="cc-platform-logo-dark" src={dark} alt="" />
    </span>
  );
}
export function bannerDisplay(gui: Record<string, unknown>) {
  const layout = ["box", "cloud", "bar"].includes(String(gui.layout))
    ? String(gui.layout)
    : "box";
  const raw = String(gui.position ?? "bottom right")
    .replaceAll("_", " ")
    .replace("middle", "center");
  const position = /^(top|center|bottom) (left|center|right)$/.test(raw)
    ? raw
    : raw === "top" || raw === "bottom"
      ? `${raw} center`
      : "bottom right";
  const placement =
    gui.button_placement === "wide" || gui.button_placement === "inline wide"
      ? "wide"
      : gui.button_placement === "inline"
        ? "inline"
        : "stacked";
  return {
    layout,
    position:
      layout === "bar"
        ? position.startsWith("top")
          ? "top center"
          : "bottom center"
        : position,
    placement,
  };
}
