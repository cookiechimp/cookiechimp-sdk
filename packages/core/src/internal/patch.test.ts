import { describe, expect, it } from "vitest";
import { acquire } from "./patch";

describe("acquire", () => {
  it("leaves a later third-party wrapper intact on release", () => {
    const original = () => "original";
    const target = { method: original };
    const release = acquire(target, "method", (descriptor) => ({
      ...descriptor,
      value: () => "ours",
    }));
    const theirs = () => "theirs";
    Object.defineProperty(target, "method", {
      ...Object.getOwnPropertyDescriptor(target, "method"),
      value: theirs,
    });

    release();

    expect(target.method).toBe(theirs);
    expect(target.method()).toBe("theirs");
  });
});
