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
    expect(region?.getAttribute("aria-label")).toBe("Consent placeholder");
    expect(region?.textContent).toBe("Consent controls will appear here.");

    await act(() => root.unmount());
  });
});
