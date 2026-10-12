import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanSimulation,
  clearSimulation,
  readSimulation,
  SIMULATION_KEY,
  writeSimulation,
} from "./simulation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SIMULATION_KEY, initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("simulation storage", () => {
  it("round-trips a valid simulation", () => {
    const storage = memory();
    expect(
      writeSimulation(
        { region: { country: "US", region: "CA" }, gpc: true },
        storage,
      ),
    ).toBe(true);
    expect(readSimulation(storage)).toEqual({
      region: { country: "US", region: "CA" },
      gpc: true,
    });
    clearSimulation(storage);
    expect(readSimulation(storage)).toBeNull();
  });

  it("accepts a null region and a missing gpc", () => {
    expect(cleanSimulation({ region: null })).toEqual({ region: null });
    expect(cleanSimulation({ gpc: false })).toEqual({ gpc: false });
  });

  it.each([
    "not json",
    "null",
    "42",
    '"DE"',
    '{"region":{"country":"de"}}',
    '{"region":{"country":"DEU"}}',
    '{"region":{"country":"<s>"}}',
    '{"region":{"country":"DE?x=1"}}',
    '{"region":{"country":"DE","region":"CA/../x"}}',
    '{"region":{"country":"DE","region":"ABCD"}}',
    '{"region":"DE"}',
    '{"gpc":"true"}',
  ])("ignores malformed stored data %s without throwing", (raw) => {
    expect(readSimulation(memory(raw))).toBeNull();
  });

  it("drops unknown and prototype keys", () => {
    const raw =
      '{"__proto__":{"polluted":true},"region":{"country":"DE","extra":"x","__proto__":{"y":1}},"gpc":true,"script":"<img>"}';
    const read = readSimulation(memory(raw));
    expect(read).toEqual({ region: { country: "DE" }, gpc: true });
    expect(Object.keys(read ?? {})).toEqual(["region", "gpc"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns null when storage throws", () => {
    expect(
      readSimulation({
        getItem() {
          throw new Error("blocked");
        },
      }),
    ).toBeNull();
  });

  it("throws in development and warns in production for invalid input", () => {
    const storage = memory();
    const bad = { region: { country: "evil.com" } } as never;
    expect(() => writeSimulation(bad, storage)).toThrow(/invalid/);
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(writeSimulation(bad, storage)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(storage.data.size).toBe(0);
  });
});
