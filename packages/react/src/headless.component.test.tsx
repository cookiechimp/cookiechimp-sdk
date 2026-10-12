import { createConsent } from "@cookiechimp/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Banner, OptOut, Preferences } from "./headless";
import { ConsentProvider } from "./index";

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
  vi.restoreAllMocks();
});

function Controls() {
  return (
    <>
      <Banner.Root modal>
        <Banner.Title>Cookies</Banner.Title>
        <Banner.Description>Your choices</Banner.Description>
        <Banner.Customize>Customize</Banner.Customize>
        <Banner.AcceptAll>Accept</Banner.AcceptAll>
        <Banner.RejectAll>Reject</Banner.RejectAll>
      </Banner.Root>
      <Preferences.Root>
        <Preferences.Title>Settings</Preferences.Title>
        <Preferences.Description>Categories</Preferences.Description>
        <Preferences.Category id="necessary">Necessary</Preferences.Category>
        <Preferences.Category id="analytics">Analytics</Preferences.Category>
        <Preferences.Save>Save</Preferences.Save>
        <Preferences.Close>Close</Preferences.Close>
      </Preferences.Root>
    </>
  );
}

describe("headless primitives", () => {
  it("wires ARIA, traps focus, restores focus, and applies only saved staging", async () => {
    const consent = createConsent({
      categories: { analytics: false },
      regulation: "gdpr",
    });
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <Controls />
        </ConsentProvider>,
      ),
    );
    const banner = host.querySelector<HTMLElement>("[data-cc-part='banner']")!;
    expect(banner.getAttribute("role")).toBe("dialog");
    expect(banner.getAttribute("aria-modal")).toBe("true");
    const customize = host.querySelector<HTMLButtonElement>(
      "[data-cc-part='banner-customize']",
    )!;
    customize.focus();
    await act(() => customize.click());
    const dialog = host.querySelector<HTMLElement>(
      "[data-cc-part='preferences']",
    )!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const switches =
      dialog.querySelectorAll<HTMLButtonElement>("[role='switch']");
    expect(switches[0]?.disabled).toBe(true);
    expect(switches[0]?.getAttribute("aria-checked")).toBe("true");
    await act(() => switches[1]?.click());
    expect(consent.has("analytics")).toBe(false);
    const last = dialog.querySelector<HTMLButtonElement>(
      "[data-cc-part='preferences-close']",
    )!;
    last.focus();
    await act(() =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(switches[1]);
    await act(() =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(consent.has("analytics")).toBe(false);
    expect(document.activeElement).toBe(customize);
    await act(() => customize.click());
    const reopened = host.querySelector<HTMLElement>(
      "[data-cc-part='preferences']",
    )!;
    await act(() =>
      reopened
        .querySelectorAll<HTMLButtonElement>("[role='switch']")[1]
        ?.click(),
    );
    await act(() =>
      reopened
        .querySelector<HTMLButtonElement>("[data-cc-part='preferences-save']")
        ?.click(),
    );
    expect(consent.has("analytics")).toBe(true);
    await act(() => root.unmount());
  });

  it("honours GPC in CCPA", async () => {
    const consent = createConsent({
      categories: ["advertising"],
      regulation: "ccpa",
      gpc: true,
    });
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <Controls />
          <OptOut.Root>
            <OptOut.Toggle />
          </OptOut.Root>
        </ConsentProvider>,
      ),
    );
    const toggle = host.querySelector<HTMLButtonElement>(
      "[data-cc-part='opt-out-toggle']",
    )!;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.textContent).toContain("GPC honoured");
    await act(() => root.unmount());
  });
});
