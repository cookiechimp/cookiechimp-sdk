import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RichText, themeStyle } from "./platform-presentation";

it("renders the same safe rich-text tree during server rendering without DOM globals", () => {
  const html = renderToStaticMarkup(
    <RichText
      value={
        '<p>A &amp; B <strong>bold</strong><br>next</p><ul><li>Choice</li></ul><a href="https://example.test/privacy" onclick="bad()">Privacy</a><script>bad()</script><a href="jav&#97;script:bad()">Unsafe</a>'
      }
    />,
  );
  expect(html).toContain("<p>A &amp; B <strong>bold</strong><br/>next</p>");
  expect(html).toContain("<ul><li>Choice</li></ul>");
  expect(html).toContain(
    'href="https://example.test/privacy" target="_blank" rel="noopener noreferrer"',
  );
  expect(html).not.toMatch(/script|onclick|bad\(\)/);
  expect(html).toContain("<span>Unsafe</span>");
});
it("omits banner branding without removing other custom footer links", () => {
  const html = renderToStaticMarkup(
    <RichText
      omitBranding
      value={
        '<a href="https://cookiechimp.com">Powered by CookieChimp</a><a href="https://example.test/terms">Terms</a>'
      }
    />,
  );
  expect(html).not.toContain("Powered by");
  expect(html).toContain("Terms");
});
it("refuses executable CSS and preserves every supported radius unit", () => {
  for (const radius of ["0px", "0.25em", "1.25rem", "50%"])
    expect(
      themeStyle({ modal_border_radius: radius })[
        "--cc-radius-card" as keyof ReturnType<typeof themeStyle>
      ],
    ).toBe(radius);
  expect(
    themeStyle({
      modal_border_radius: "url(evil)",
      btn_border_radius: "1px; color:red",
      colors: { bg: "red; background:url(evil)" },
    }),
  ).toEqual({});
});
