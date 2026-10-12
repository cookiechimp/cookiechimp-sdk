import { describe, expect, it } from "vitest";
import { isHttpUrl } from "./url";

describe("isHttpUrl", () => {
  it.each([
    "java\nscript:alert(1)",
    "\x01javascript:alert(1)",
    "da\nta:text/plain,bad",
    "java\tscript:alert(1)",
    "\tdata:text/plain,bad",
  ])("rejects disguised non-HTTP URL %j", (source) => {
    expect(isHttpUrl(source, "https://site.test/path/")).toBe(false);
  });

  it("accepts absolute and relative HTTP URLs", () => {
    expect(isHttpUrl("https://cdn.test/file.js", "https://site.test/")).toBe(
      true,
    );
    expect(isHttpUrl("/file.js", "https://site.test/path/")).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(isHttpUrl("http://[", "https://site.test/")).toBe(false);
  });
});
