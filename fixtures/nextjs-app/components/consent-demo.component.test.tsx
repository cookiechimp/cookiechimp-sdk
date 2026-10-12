import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ConsentDemo } from "./consent-demo";

afterEach(() => {
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
});

describe("ConsentDemo", () => {
  it("accepts analytics from the client control", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() => root.render(<ConsentDemo />));
    const button = document.querySelector("button");
    await act(() => button?.click());
    expect(
      document.querySelector("[data-testid='consent-status']")?.textContent,
    ).toBe("Analytics accepted");
    expect(document.cookie).toContain("cc_consent=v1.");
    await act(() => root.unmount());
  });
});
