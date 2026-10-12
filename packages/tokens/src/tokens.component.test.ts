import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("generated token CSS", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-cc-theme");
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it("defines root properties and switches banner properties for dark mode", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(
      resolve(import.meta.dirname, "../dist/tokens.css"),
      "utf8",
    );
    document.head.append(style);
    const sample = document.createElement("div");
    sample.style.backgroundColor = "var(--cc-banner-bg)";
    document.body.append(sample);

    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--cc-color-brand-primary")
        .trim(),
    ).toBe("#2b5cf2");
    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--cc-banner-bg")
        .trim(),
    ).toBe("#ffffff");
    document.documentElement.dataset.ccTheme = "dark";
    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--cc-banner-bg")
        .trim(),
    ).toBe("#171a1c");
  });
});
