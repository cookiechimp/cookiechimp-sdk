import { createConsent } from "@cookiechimp/core";
import { useBanner } from "@cookiechimp/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PagesConsentProvider } from "./pages";

function State() {
  return useBanner().open ? <span data-banner="">banner</span> : null;
}

describe("PagesConsentProvider", () => {
  it("hydrates the server snapshot without a markup mismatch", async () => {
    const config = { categories: { analytics: false } };
    const consent = createConsent(config).acceptAll();
    const app = (
      <PagesConsentProvider
        config={config}
        consent={consent}
        region={{ country: "DE" }}
      >
        <State />
      </PagesConsentProvider>
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
