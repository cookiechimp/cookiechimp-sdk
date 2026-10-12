import { createConsent } from "@cookiechimp/core";
import { useBanner } from "@cookiechimp/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClientProvider } from "./index";

vi.mock("server-only", () => ({}));

function BannerState() {
  return useBanner().open ? <div data-banner="">banner</div> : null;
}

describe("ClientProvider", () => {
  it("hydrates the server snapshot without a markup mismatch", async () => {
    const config = { categories: { analytics: false } };
    const initialState = createConsent(config).acceptAll();
    const app = (
      <ClientProvider config={config} initialState={initialState}>
        <BannerState />
      </ClientProvider>
    );
    const html = renderToString(app);
    expect(html).not.toContain("data-banner");
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

describe("critical CSS", () => {
  it("contains token variables and fixed banner layout", async () => {
    const { criticalCss } = await import("./critical-css.generated");
    expect(criticalCss).toContain("--cc-banner-bg");
    expect(criticalCss).toContain(".cc-banner");
    expect(criticalCss).toContain("position: fixed");
    expect(criticalCss).toContain(
      "@media (max-width: 640px) {\n  .cc-banner {\n    flex-direction: column;",
    );
    expect(criticalCss).toContain("box-sizing: border-box");
  });
});
