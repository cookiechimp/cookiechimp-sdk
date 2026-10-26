// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieChimp, resetCookieChimp } from "./api";
import { useCategory, useConsent } from "./hooks";
import { CookieChimpProvider } from "./provider";
import { memoryStorage } from "./storage";

const bundle = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;
const fetch = vi.fn(async () => Response.json({ synced: [], failed: [] }));

function Screen() {
  const analytics = useCategory("analytics");
  const consent = useConsent();
  return (
    <p data-testid="app">
      app {consent ? "ready" : "loading"} analytics {String(analytics)}
    </p>
  );
}

async function render(props: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(
      <CookieChimpProvider
        config={bundle}
        country="DE"
        storage={memoryStorage()}
        fetch={fetch}
        {...props}
      >
        <Screen />
      </CookieChimpProvider>,
    );
  });
  await act(async () => {
    await vi.waitFor(() =>
      expect(container.textContent).toContain("app ready"),
    );
  });
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === name,
  ) as HTMLButtonElement;
const press = async (name: string) => {
  await act(async () => button(name).click());
};
const banner = () =>
  container.querySelector('[data-testid="cookiechimp-banner"]');
const preferences = () =>
  container.querySelector('[data-testid="cookiechimp-preferences"]');

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetCookieChimp();
});

describe("CookieChimpProvider", () => {
  it("renders the app first, then the dashboard banner", async () => {
    act(() => {
      root.render(
        <CookieChimpProvider
          config={bundle}
          country="DE"
          storage={memoryStorage()}
        >
          <Screen />
        </CookieChimpProvider>,
      );
    });
    expect(container.textContent).toContain("app loading");
    await act(async () => {
      await vi.waitFor(() => expect(banner()).not.toBeNull());
    });
    expect(banner()?.textContent).toContain("We value your privacy");
    expect(banner()?.getAttribute("lang")).toBe("en");
    expect(container.querySelector('[role="header"]')?.textContent).toBe(
      "We value your privacy",
    );
  });

  it("records Accept All and closes the banner", async () => {
    await render();
    await press("Accept All");
    expect(banner()).toBeNull();
    expect(container.textContent).toContain("analytics true");
  });

  it("records Reject All", async () => {
    await render();
    await press("Reject All");
    expect(banner()).toBeNull();
    expect(container.textContent).toContain("analytics false");
  });

  it("saves a category selection from the preferences screen", async () => {
    await render();
    await press("Manage Preferences");
    expect(banner()).toBeNull();
    expect(preferences()?.textContent).toContain("Cookie Settings");
    const toggles = [
      ...container.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
    ];
    const essential = toggles.find(
      (input) => input.getAttribute("aria-label") === "Essential",
    );
    expect(essential?.disabled).toBe(true);
    const analytics = toggles.find(
      (input) => input.getAttribute("aria-label") === "Analytics",
    );
    expect(analytics?.getAttribute("aria-checked")).toBe("false");
    await act(async () => analytics?.click());
    await press("Save Preferences");
    expect(preferences()).toBeNull();
    expect(container.textContent).toContain("analytics true");
    expect(CookieChimp.acceptedService("Google Analytics", "analytics")).toBe(
      true,
    );
    expect(CookieChimp.acceptedCategory("marketing")).toBe(false);
  });

  it("lets the app reopen preferences after a decision", async () => {
    await render();
    await press("Accept All");
    await act(async () => CookieChimp.showPreferences());
    expect(preferences()).not.toBeNull();
    await press("Close");
    expect(preferences()).toBeNull();
  });

  it("renders the full screen layout and shows vendor and cookie details", async () => {
    const fullscreen = structuredClone(bundle) as {
      banners: Record<string, { gui_options: Record<string, unknown> }>;
    };
    for (const banner of Object.values(fullscreen.banners))
      banner.gui_options.layout = "fullscreen";
    await render({ config: fullscreen });
    expect(banner()?.textContent).toContain("We value your privacy");
    await press("Manage Preferences");
    await press("Analytics");
    await press("Google Analytics");
    const text = preferences()?.textContent ?? "";
    expect(text).toContain("Google LLC");
    expect(text).toContain("_ga");
    expect(text).toContain("2 years");
    expect(button("Google Analytics")?.getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("shows the recall button after a decision when asked to", async () => {
    await render({ recallButton: true });
    const recall = () =>
      container.querySelector('[data-testid="cookiechimp-recall"]');
    expect(recall()).toBeNull();
    await press("Accept All");
    expect(recall()).not.toBeNull();
    await press("Cookie Settings");
    expect(preferences()).not.toBeNull();
  });

  it("renders no built-in UI with ui={false}", async () => {
    await render({ ui: false });
    expect(banner()).toBeNull();
  });

  it("forwards the latest callback props", async () => {
    const first = vi.fn();
    await render({ onFirstConsent: first });
    await press("Accept All");
    expect(first).toHaveBeenCalledWith(
      expect.objectContaining({ acceptType: "all" }),
    );
  });
});
