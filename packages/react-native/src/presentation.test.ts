import { describe, expect, it } from "vitest";
import { alpha, palette, radius, rich, withoutBranding } from "./presentation";
import { bannerDisplay } from "./ui/banner";

describe("rich", () => {
  it("keeps paragraphs, safe links and emphasis", () => {
    expect(
      rich(
        '<p>Read our <a href="https://example.com/privacy">policy</a>.</p><p><strong>Bold</strong> &amp; <a href="javascript:alert(1)">bad</a></p>',
      ),
    ).toEqual([
      [
        { text: "Read our " },
        { text: "policy", href: "https://example.com/privacy" },
        { text: "." },
      ],
      [{ text: "Bold", bold: true }, { text: " & " }, { text: "bad" }],
    ]);
  });

  it("lists items and ignores empty input", () => {
    expect(rich("<ul><li>One</li><li>Two</li></ul>")).toEqual([
      [{ text: "• " }, { text: "One" }],
      [{ text: "• " }, { text: "Two" }],
    ]);
    expect(rich(" ")).toEqual([]);
    expect(rich(undefined)).toEqual([]);
  });
});

describe("theme", () => {
  it("reads dashboard radii in px, rem and em", () => {
    expect(radius("8px", 0)).toBe(8);
    expect(radius("0.5rem", 0)).toBe(8);
    expect(radius("1em", 0)).toBe(16);
    expect(radius("50%", 3)).toBe(3);
  });

  it("derives outlines from the text color and picks the logo for the scheme", () => {
    expect(alpha("#333", 0.5)).toBe("rgba(51,51,51,0.5)");
    const theme = {
      dark_mode: "auto",
      colors: { text_color: "#112233" },
      logo_url_light: "https://example.com/light.png",
      logo_url_dark: "https://example.com/dark.png",
    };
    expect(palette(theme, "light")).toMatchObject({
      scheme: "light",
      border: "rgba(17,34,51,0.16)",
      logo: "https://example.com/light.png",
    });
    expect(palette(theme, "dark").logo).toBe("https://example.com/dark.png");
  });
});

describe("bannerDisplay", () => {
  it("maps the dashboard layout, position and button placement", () => {
    expect(
      bannerDisplay({
        layout: "box",
        position: "top right",
        button_placement: "wide",
      }),
    ).toEqual({
      layout: "box",
      placement: "wide",
      vertical: "top",
      horizontal: "right",
    });
    expect(
      bannerDisplay({ layout: "bar", position: "middle left" }),
    ).toMatchObject({ vertical: "bottom", horizontal: "center" });
    expect(
      bannerDisplay({ layout: "fullscreen", button_placement: "inline" }),
    ).toMatchObject({ layout: "fullscreen", placement: "inline" });
    expect(bannerDisplay({ layout: "unknown" }).layout).toBe("box");
  });
});

describe("withoutBranding", () => {
  it("drops the CookieChimp credit and keeps other footer links", () => {
    expect(
      withoutBranding(
        '<a href=\'https://example.test/terms\'>Terms</a> <a href="https://www.cookiechimp.com/" target="_blank">Powered by <b>CookieChimp</b></a>',
      ),
    ).toBe("<a href='https://example.test/terms'>Terms</a> ");
    expect(
      withoutBranding(
        "<a href='https://cookiechimp.com/privacy.php'>Privacy</a>",
      ),
    ).toContain("Privacy");
  });
});
