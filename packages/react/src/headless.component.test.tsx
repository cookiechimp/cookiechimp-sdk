import { createConsent } from "@cookiechimp/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Banner, OptOut, Preferences } from "./headless";
import { ConsentProvider, usePreferences } from "./index";

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
        <Preferences.AcceptAll>Accept all</Preferences.AcceptAll>
        <Preferences.RejectAll>Reject all</Preferences.RejectAll>
        <Preferences.Close>Close</Preferences.Close>
      </Preferences.Root>
    </>
  );
}

describe("headless primitives", () => {
  it("initially focuses, traps, dismisses, and restores a modal banner", async () => {
    const before = document.body.appendChild(document.createElement("button"));
    before.focus();
    const consent = createConsent({
      categories: ["analytics"],
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
    const dialog = host.querySelector<HTMLElement>("[data-cc-part='banner']")!;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>("button");
    expect(document.activeElement).toBe(buttons[0]);
    buttons[buttons.length - 1]?.focus();
    await act(() =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0]?.focus();
    await act(() =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    await act(() =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(host.querySelector("[data-cc-part='banner']")).toBeNull();
    expect(document.activeElement).toBe(before);
    await act(() => root.unmount());
  });

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
        .querySelector<HTMLButtonElement>(`[data-cc-part='${part}']`)
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

  it("renders an honoured GPC opt-out outside CCPA", async () => {
    const consent = createConsent({
      categories: ["advertising"],
      regulation: "gdpr",
      gpc: true,
    });
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <OptOut.Root>
            <OptOut.Toggle />
          </OptOut.Root>
        </ConsentProvider>,
      ),
    );
    expect(
      host
        .querySelector("[data-cc-part='opt-out']")
        ?.getAttribute("data-cc-state"),
    ).toBe("on");
    await act(() => root.unmount());
  });

  it("restores a custom preferences opener", async () => {
    function Custom() {
      const preferences = usePreferences();
      return (
        <>
          <button type="button" onClick={preferences.show}>
            Open
          </button>
          <Preferences.Root>
            <Preferences.Title>Settings</Preferences.Title>
            <Preferences.Description>Choices</Preferences.Description>
            <Preferences.Close>Close</Preferences.Close>
          </Preferences.Root>
        </>
      );
    }
    const consent = createConsent({ categories: [], regulation: "gdpr" });
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <Custom />
        </ConsentProvider>,
      ),
    );
    const opener = host.querySelector("button")!;
    opener.focus();
    await act(() => opener.click());
    await act(() =>
      host
        .querySelector<HTMLButtonElement>("[data-cc-part='preferences-close']")
        ?.click(),
    );
    expect(document.activeElement).toBe(opener);
    await act(() => root.unmount());
  });

  it.each([
    ["Save", "preferences-save", "recall", true],
    ["Save", "preferences-save", "body", false],
    ["Accept all", "preferences-accept-all", "recall", true],
    ["Accept all", "preferences-accept-all", "body", false],
  ])(
    "%s closing the banner falls back to %s (%s)",
    async (_, part, _target, withRecall) => {
      const consent = createConsent({ categories: [], regulation: "gdpr" });
      const host = document.body.appendChild(document.createElement("div"));
      const root = createRoot(host);
      await act(() =>
        root.render(
          <ConsentProvider consent={consent}>
            <Controls />
            {withRecall && (
              <button
                type="button"
                data-cc-part="recall"
                data-cc-state="closed"
              >
                Recall
              </button>
            )}
          </ConsentProvider>,
        ),
      );
      const opener = host.querySelector<HTMLButtonElement>(
        "[data-cc-part='banner-customize']",
      )!;
      opener.focus();
      await act(() => opener.click());
      await act(() =>
        host
          .querySelector<HTMLButtonElement>(`[data-cc-part='${part}']`)
          ?.click(),
      );
      expect(host.querySelector("[data-cc-part='banner']")).toBeNull();
      expect(host.querySelector("[data-cc-part='preferences']")).toBeNull();
      expect(opener.isConnected).toBe(false);
      expect(document.activeElement).toBe(
        withRecall
          ? host.querySelector("[data-cc-part='recall']")
          : document.body,
      );
      await act(() => root.unmount());
    },
  );

  it("adds state to every rendered headless part", async () => {
    const consent = createConsent({
      categories: ["analytics"],
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
    await act(() =>
      host
        .querySelector<HTMLButtonElement>("[data-cc-part='banner-customize']")
        ?.click(),
    );
    const parts = host.querySelectorAll("[data-cc-part]");
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts)
      expect(part.hasAttribute("data-cc-state")).toBe(true);
    await act(() => root.unmount());
  });
});
