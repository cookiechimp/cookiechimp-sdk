import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "./platform";

const fixture = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
);
let cleanup = () => {};
afterEach(() => {
  act(cleanup);
  document.body.replaceChildren();
  document.documentElement.lang = "";
  document.documentElement.removeAttribute("dir");
  // biome-ignore lint/suspicious/noDocumentCookie: Clear only the isolated test cookie.
  document.cookie = "cc_variations=; Max-Age=0; Path=/";
});
function mount(
  change = (_bundle: typeof fixture) => {},
  region = "IE",
  locale: string | null = "en",
) {
  const bundle = structuredClone(fixture);
  change(bundle);
  const root = createRoot(
    document.body.appendChild(document.createElement("div")),
  );
  act(() =>
    root.render(
      <PlatformConsentProvider
        bundle={bundle}
        region={region}
        locale={locale ?? undefined}
        cookie={{ name: "cc_variations" }}
      >
        <main>Host application</main>
        <CookieBanner />
        <CookiePreferences />
        <RecallButton />
      </PlatformConsentProvider>,
    ),
  );
  cleanup = () => root.unmount();
}
const click = (part: string) =>
  act(() =>
    document
      .querySelector<HTMLButtonElement>(`[data-cc-part="${part}"]`)
      ?.click(),
  );
for (const layout of ["box", "cloud", "bar"]) {
  const positions =
    layout === "bar"
      ? ["top center", "bottom center"]
      : [
          "top left",
          "top center",
          "top right",
          "middle left",
          "middle center",
          "middle right",
          "bottom left",
          "bottom center",
          "bottom right",
        ];
  for (const position of positions)
    it(`preserves ${layout} at ${position}`, () => {
      mount((bundle) =>
        Object.assign(bundle.banners.bnrEU1.gui_options, { layout, position }),
      );
      const banner = document.querySelector('[data-cc-part="banner"]');
      expect(banner?.getAttribute("data-cc-layout")).toBe(layout);
      expect(banner?.getAttribute("data-cc-position")).toBe(
        position.replace("middle", "center"),
      );
    });
}
it.each(["stacked", "inline", "wide", "inline wide"])(
  "maps %s button placement without losing actions",
  (placement) => {
    mount((bundle) =>
      Object.assign(bundle.banners.bnrEU1.gui_options, {
        button_placement: placement,
        swap_buttons: true,
        equal_weight_buttons: true,
      }),
    );
    expect(
      document
        .querySelector('[data-cc-part="banner"]')
        ?.getAttribute("data-cc-button-placement"),
    ).toBe(placement === "inline wide" ? "wide" : placement);
    const actions = [
      ...document.querySelectorAll(".cc-platform-banner .cc-actions button"),
    ];
    expect(actions.map((node) => node.getAttribute("data-cc-part"))).toEqual([
      "banner-customize",
      "banner-reject-all",
      "banner-accept-all",
    ]);
    expect(actions[1]?.classList.contains("cc-button--primary")).toBe(true);
    expect(actions[2]?.classList.contains("cc-button--primary")).toBe(true);
  },
);
it("keeps accept primary, makes reject secondary when unequal, and honors visibility flags", () => {
  mount((bundle) => {
    bundle.banners.bnrEU1.gui_options.equal_weight_buttons = false;
    bundle.banners.bnrEU1.buttons.show_preferences_btn = false;
    bundle.banners.bnrEU1.buttons.show_close_btn = true;
  });
  expect(
    document.querySelector('[data-cc-part="banner-customize"]'),
  ).toBeNull();
  expect(
    document.querySelector('[data-cc-part="banner-reject-all"]')?.className,
  ).toContain("secondary");
  expect(
    document.querySelector('[data-cc-part="banner-accept-all"]')?.className,
  ).toContain("primary");
  click("banner-close");
  expect(document.querySelector('[data-cc-part="banner"]')).toBeNull();
});
it.each(["left", "right"])(
  "renders a full-height %s preferences panel",
  (position) => {
    mount((bundle) =>
      Object.assign(bundle.banners.bnrEU1.preferences_gui_options, {
        layout: "bar",
        position,
      }),
    );
    click("banner-customize");
    expect(
      document
        .querySelector('[data-cc-part="preferences"]')
        ?.getAttribute("data-cc-layout"),
    ).toBe("bar");
    expect(
      document
        .querySelector('[data-cc-part="preferences"]')
        ?.getAttribute("data-cc-position"),
    ).toBe(position);
  },
);
it.each(["auto", "light", "dark"])(
  "keeps %s theme colors, CSS-unit radii and both logos",
  (mode) => {
    mount((bundle) =>
      Object.assign(bundle.banners.bnrEU1.theme, {
        dark_mode: mode,
        modal_border_radius: "1.25rem",
        btn_border_radius: "50%",
        logo_url_light: "https://example.test/light.svg",
        logo_url_dark: "https://example.test/dark.svg",
        colors: { bg: "#ffeedd" },
        dark_colors: { bg: "#112233" },
      }),
    );
    const root = document.querySelector<HTMLElement>("[data-cc-platform]");
    expect(root?.getAttribute("data-cc-theme")).toBe(mode);
    expect(root?.style.getPropertyValue("--cc-platform-light-bg")).toBe(
      "#ffeedd",
    );
    expect(root?.style.getPropertyValue("--cc-platform-dark-bg")).toBe(
      "#112233",
    );
    expect(root?.style.getPropertyValue("--cc-radius-card")).toBe("1.25rem");
    expect(root?.style.getPropertyValue("--cc-radius-button")).toBe("50%");
    expect(
      document.querySelector<HTMLImageElement>(".cc-platform-logo-light")?.src,
    ).toBe("https://example.test/light.svg");
    expect(
      document.querySelector<HTMLImageElement>(".cc-platform-logo-dark")?.src,
    ).toBe("https://example.test/dark.svg");
  },
);
it("preserves rich copy, additional description and custom footer links without executing HTML", () => {
  mount((bundle) => {
    const copy = bundle.translations.bnrEU1.en.consent_modal;
    copy.description =
      '<p>Hello <strong>world</strong>.</p><ul><li>One</li></ul><script>alert(1)</script><img src=x onerror=alert(1)><a href="jav&#97;script:alert(1)" onclick="alert(1)">Unsafe</a>';
    copy.additional_description = "<p>More <em>detail</em> &amp; context.</p>";
    copy.footer = '<a href="https://example.test/terms">Terms</a>';
  });
  expect(document.querySelector(".cc-description strong")?.textContent).toBe(
    "world",
  );
  expect(document.querySelector(".cc-description li")?.textContent).toBe("One");
  expect(
    document.querySelector(".cc-platform-additional em")?.textContent,
  ).toBe("detail");
  expect(
    document.querySelector(".cc-platform-footer a")?.getAttribute("href"),
  ).toBe("https://example.test/terms");
  expect(
    document.querySelector(
      "script, img, [onclick], [onerror], a[href^='javascript:']",
    ),
  ).toBeNull();
});
it("shows Powered by CookieChimp in the banner footer when the plan asks for it", () => {
  mount((bundle) => {
    bundle.banners.bnrEU1.footer.show_powered_by = true;
    bundle.translations.bnrEU1.en.consent_modal.footer =
      "<a href='https://cookiechimp.com'>Powered by CookieChimp</a>";
  });
  const footer = document.querySelector(".cc-platform-footer");
  expect(footer?.textContent?.match(/Powered by CookieChimp/g)).toHaveLength(1);
  expect(
    footer?.querySelector(".cc-platform-powered-by")?.getAttribute("href"),
  ).toBe("https://cookiechimp.com");
});
it("hides Powered by CookieChimp in the banner on paid plans, but keeps it in the preferences", () => {
  mount((bundle) => {
    bundle.banners.bnrEU1.footer.show_powered_by = false;
  });
  const banner = document.querySelector('[data-cc-part="banner"]');
  expect(banner?.textContent).not.toMatch(/Powered by CookieChimp/);
  click("banner-customize");
  const preferences = document.querySelector('[data-cc-part="preferences"]');
  expect(
    preferences?.querySelector(".cc-platform-branding")?.getAttribute("href"),
  ).toBe("https://cookiechimp.com");
});
it("blocks page interaction and Escape dismissal when force_consent is set", () => {
  mount((bundle) => {
    bundle.banners.bnrEU1.force_consent = true;
  });
  const banner = document.querySelector('[data-cc-part="banner"]');
  expect(banner?.getAttribute("aria-modal")).toBe("true");
  expect(
    document.querySelector('[data-cc-part="banner-backdrop"]'),
  ).not.toBeNull();
  expect(document.documentElement.style.overflow).toBe("hidden");
  act(() =>
    banner?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(document.querySelector('[data-cc-part="banner"]')).not.toBeNull();
  click("banner-reject-all");
  expect(document.querySelector('[data-cc-part="banner-backdrop"]')).toBeNull();
  expect(document.documentElement.style.overflow).not.toBe("hidden");
});
it("shows the opt-out notice with enabled defaults and persists dismissal after a choice", () => {
  mount(() => {}, "US");
  expect(document.querySelector('[data-cc-part="banner"]')).not.toBeNull();
  click("banner-reject-all");
  expect(document.querySelector('[data-cc-part="banner"]')).toBeNull();
  act(cleanup);
  mount(() => {}, "US");
  expect(document.querySelector('[data-cc-part="banner"]')).toBeNull();
});
it("uses the configured document language when no locale override is supplied", () => {
  document.documentElement.lang = "de-DE";
  mount(() => {}, "IE", null);
  expect(
    document.querySelector('[data-cc-part="banner"]')?.getAttribute("lang"),
  ).toBe("de");
});

it("scopes Arabic language and direction to consent UI without changing the host", () => {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  mount(
    (bundle) => {
      bundle.translations.bnrEU1.ar = bundle.translations.bnrEU1.en;
      bundle.banners.bnrEU1.available_languages.push("ar");
    },
    "IE",
    "ar",
  );
  const wrapper = document.querySelector("[data-cc-platform]");
  expect(wrapper?.hasAttribute("lang")).toBe(false);
  expect(wrapper?.hasAttribute("dir")).toBe(false);
  const host = document.querySelector("main");
  expect(host?.closest("[lang]")?.getAttribute("lang")).toBe("en");
  expect(host?.closest("[dir]")?.getAttribute("dir")).toBe("ltr");
  const banner = document.querySelector('[data-cc-part="banner"]');
  expect(banner?.getAttribute("lang")).toBe("ar");
  expect(banner?.getAttribute("dir")).toBe("rtl");
  click("banner-customize");
  const preferences = document.querySelector('[data-cc-part="preferences"]');
  expect(preferences?.getAttribute("lang")).toBe("ar");
  expect(preferences?.getAttribute("dir")).toBe("rtl");
  click("preferences-reject-all");
  const recall = document.querySelector('[data-cc-part="recall"]');
  expect(recall?.getAttribute("lang")).toBe("ar");
  expect(recall?.getAttribute("dir")).toBe("rtl");
  expect(host?.closest("[dir]")?.getAttribute("dir")).toBe("ltr");
});
