import { ConsentProvider } from "@cookiechimp/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { consentConfig } from "../consent-config";
import { ConsentDemo } from "./consent-demo";

afterEach(() => {
  delete document.documentElement.dataset.ccDynamic;
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
});

describe("ConsentDemo", () => {
  it("accepts analytics from the client control", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() =>
      root.render(
        <ConsentProvider config={consentConfig}>
          <ConsentDemo />
        </ConsentProvider>,
      ),
    );
    expect(document.documentElement.dataset.ccDynamic).toBe("ready");
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === "Accept all cookies",
    );
    await act(() => button?.click());
    expect(
      document.querySelector("[data-testid='consent-status']")?.textContent,
    ).toBe("Analytics accepted");
    expect(document.cookie).toContain("cc_consent=v1.");
    await act(() => root.unmount());
  });
});
