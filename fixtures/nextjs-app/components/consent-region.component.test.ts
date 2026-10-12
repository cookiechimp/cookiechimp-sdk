import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ConsentRegion } from "./consent-region";

afterEach(() => {
  document.body.replaceChildren();
});

describe("ConsentRegion", () => {
  it("renders an accessible placeholder", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => root.render(createElement(ConsentRegion)));

    const region = document.querySelector<HTMLElement>(
      "[data-testid='consent-region']",
    );
    expect(region?.getAttribute("aria-label")).toBe("Regional consent");
    expect(region?.textContent).toContain("decision needed");
    expect(region?.textContent).toContain("analytics off");

    const button = document.querySelector("button");
    await act(() => button?.click());
    expect(region?.textContent).toContain("no decision needed");

    await act(() => root.unmount());
  });

  it("honours browser GPC for a CCPA region and persists gpc_auto", async () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() =>
      root.render(
        createElement(ConsentRegion, {
          region: { country: "US", region: "CA" },
          gpc: true,
        }),
      ),
    );
    expect(container.textContent).toContain("advertising off");
    expect(container.textContent).toContain("gpc_auto");
    expect(document.cookie).toContain("cc_consent=v1.");
    await act(() => root.unmount());
    // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
    document.cookie = "cc_consent=; Path=/; Max-Age=0";
  });
});
