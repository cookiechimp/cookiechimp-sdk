import { type ConsentState, createConsent } from "@cookiechimp/core";
import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ConsentProvider,
  useBanner,
  useCategory,
  useConsent,
  useConsentActions,
  useOnConsentChange,
  usePreferences,
  useRegion,
  useTranslations,
} from "./index";

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.innerHTML = "";
  // biome-ignore lint/suspicious/noDocumentCookie: tests reset the SDK's cookie between cases.
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
});

const config = {
  categories: { analytics: false },
  regulation: "gdpr" as const,
};

function Status({ changed }: { changed?: (state: ConsentState) => void }) {
  const state = useConsent();
  const accepted = useCategory("analytics");
  const actions = useConsentActions();
  const banner = useBanner();
  const preferences = usePreferences();
  const region = useRegion();
  const { t } = useTranslations();
  useOnConsentChange(changed ?? (() => {}));
  return (
    <div>
      <span data-state={state.action}>{String(accepted)}</span>
      <span>{region.regulation}</span>
      <span>{t("title", "fallback")}</span>
      {banner.open && <b>banner</b>}
      {preferences.open && <i>preferences</i>}
      <button type="button" onClick={actions.acceptAll}>
        accept
      </button>
      <button type="button" onClick={preferences.show}>
        preferences
      </button>
    </div>
  );
}

describe("ConsentProvider hooks", () => {
  it("creates a runtime from config, updates hooks, and keeps actions stable", async () => {
    const target = document.body.appendChild(document.createElement("div"));
    const changed = vi.fn();
    let firstActions: ReturnType<typeof useConsentActions> | undefined;
    function Capture() {
      const actions = useConsentActions();
      firstActions ??= actions;
      expect(actions).toBe(firstActions);
      return <Status changed={changed} />;
    }
    const root = createRoot(target);
    await act(() =>
      root.render(
        <ConsentProvider config={config} translations={{ title: "Cookies" }}>
          <Capture />
        </ConsentProvider>,
      ),
    );
    expect(target.textContent).toContain("banner");
    expect(target.textContent).toContain("Cookies");
    await act(() => target.querySelector<HTMLButtonElement>("button")?.click());
    expect(target.querySelector("span")?.textContent).toBe("true");
    expect(target.textContent).not.toContain("banner");
    expect(changed).toHaveBeenCalledOnce();
    await act(() => root.unmount());
  });

  it("accepts an existing runtime and controls preferences", async () => {
    const consent = createConsent(config);
    const target = document.body.appendChild(document.createElement("div"));
    const root = createRoot(target);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <Status />
        </ConsentProvider>,
      ),
    );
    await act(() =>
      target.querySelectorAll<HTMLButtonElement>("button")[1]?.click(),
    );
    expect(target.textContent).toContain("preferences");
    await act(() => root.unmount());
  });

  it("shares preference visibility across hook consumers", async () => {
    const consent = createConsent(config);
    const target = document.body.appendChild(document.createElement("div"));
    function Preference({ label }: { label: string }) {
      const preferences = usePreferences();
      return (
        <button type="button" onClick={preferences.show}>
          {label}:{String(preferences.open)}
        </button>
      );
    }
    const root = createRoot(target);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent}>
          <Preference label="first" />
          <Preference label="second" />
        </ConsentProvider>,
      ),
    );
    await act(() => target.querySelector("button")?.click());
    expect(target.textContent).toContain("first:true");
    expect(target.textContent).toContain("second:true");
    await act(() => root.unmount());
  });

  it("uses the runtime snapshot on the client instead of initialState", async () => {
    const consent = createConsent(config);
    consent.acceptAll();
    const initial = createConsent(config).rejectAll();
    const target = document.body.appendChild(document.createElement("div"));
    const root = createRoot(target);
    await act(() =>
      root.render(
        <ConsentProvider consent={consent} initialState={initial}>
          <Status />
        </ConsentProvider>,
      ),
    );
    expect(target.querySelector("span")?.textContent).toBe("true");
    await act(() => root.unmount());
  });

  it("hydrates an initial snapshot without mismatch warnings", async () => {
    const initial = createConsent(config).acceptAll();
    const app = (
      <ConsentProvider config={config} initialState={initial}>
        <Status />
      </ConsentProvider>
    );
    const html = renderToString(app);
    expect(html).not.toContain("banner");
    const target = document.body.appendChild(document.createElement("div"));
    target.innerHTML = html;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = hydrateRoot(target, app);
    await act(async () => {});
    expect(error.mock.calls.flat().join(" ")).not.toContain("hydration");
    error.mockRestore();
    await act(() => root.unmount());
  });
});
