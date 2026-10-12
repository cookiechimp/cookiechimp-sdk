import { describe, expect, it } from "vitest";
import { inlineJson } from "./inline-json";

describe("inlineJson", () => {
  it("escapes </script>, U+2028 and U+2029 while preserving the value", () => {
    const value = { text: "</script>\u2028x\u2029" };
    const out = inlineJson(value);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(out).toContain("\\u003c/script>");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(new Function(`return ${out}`)()).toEqual(value);
  });
});
