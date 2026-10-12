import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import preset from "./tailwind";
import { tokens } from "./tokens";

const dist = (name: string) =>
  readFileSync(resolve(import.meta.dirname, `../dist/${name}`), "utf8");

describe("design tokens", () => {
  it("matches the reviewed source of truth", () => {
    expect(tokens).toMatchSnapshot();
    expect(tokens.color.brand.primary).toBe("#2b5cf2");
    expect(tokens.color.platform.text).toBe("oklch(21% 0.006 285.885)");
    expect(tokens.color.status.purple.fill).toBe(
      "color-mix(in oklch, oklch(55.8% 0.288 302.321) 10%, transparent)",
    );
    expect(tokens.banner.dark.bg).toBe("#171a1c");
    expect(tokens.typography.body).toEqual({
      size: "14px",
      lineHeight: "20px",
      weight: "400",
    });
    expect(tokens.focus.outline).toBe("2px solid #fff");
  });

  it("generates JSON directly from the source", () => {
    expect(JSON.parse(dist("tokens.json"))).toEqual(tokens);
  });

  it("generates prefixed CSS variables once in each applicable block", () => {
    const css = dist("tokens.css");
    const blocks = [
      ...css.matchAll(/(?::root|\[data-cc-theme="dark"\]) \{([^}]+)\}/g),
    ].map((match) => match[1] ?? "");
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      const names = [...block.matchAll(/--cc-[\w-]+(?=:)/g)].map(
        ([name]) => name,
      );
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((name) => name.startsWith("--cc-"))).toBe(true);
    }
    const [, darkBlock = ""] = blocks;
    const darkNames = [...darkBlock.matchAll(/--cc-([\w-]+)(?=:)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(darkNames.length).toBeGreaterThan(0);
    expect(darkNames.every((name) => name.startsWith("banner-"))).toBe(true);
    expect(css).not.toContain(String.fromCodePoint(0x2014));
  });

  it("uses only variables present in the generated CSS in the Tailwind preset", () => {
    const references = JSON.stringify(preset).match(/--cc-[\w-]+/g) ?? [];
    const css = dist("tokens.css");
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(css).toContain(`${reference}:`);
  });
});
