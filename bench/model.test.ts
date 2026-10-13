import { describe, expect, it } from "vitest";
import { median, type Sample, summarize } from "./model";

const sample = (changes: Partial<Sample> = {}): Sample => ({
  fixture: "cookiechimp",
  iteration: 1,
  status: "passed",
  jsGzipBytes: 10,
  htmlGzipBytes: 5,
  cssGzipBytes: 2,
  lcpMs: 100,
  cls: 0,
  bannerVisibleMs: 80,
  interactionMs: null,
  returningBannerVisible: false,
  lighthouseLcpMs: 105,
  lighthouseCls: 0,
  lighthouseTbtMs: 0,
  ...changes,
});

describe("benchmark reporting", () => {
  it("calculates medians without mutating raw observations", () => {
    const values = [7, 1, 3, 5];
    expect(median(values)).toBe(4);
    expect(values).toEqual([7, 1, 3, 5]);
    expect(median([])).toBeNull();
    expect(() => median([Number.NaN])).toThrow();
  });
  it("withholds results for failed or missing attempts", () => {
    expect(summarize([sample()], 2)[0]?.medians.jsGzipBytes).toBeNull();
    expect(
      summarize([sample({ status: "failed" })], 1)[0]?.medians.jsGzipBytes,
    ).toBeNull();
  });
  it("preserves a measured zero and withholds unavailable interaction timing", () => {
    const result = summarize([sample()], 1)[0];
    expect(result?.complete).toBe(true);
    expect(result?.medians.cls).toBe(0);
    expect(result?.medians.interactionMs).toBeNull();
  });
});
