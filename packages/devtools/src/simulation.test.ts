import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanSimulation,
  clearSimulation,
  readSimulation,
  SIMULATION_KEY,
  writeSimulation,
} from "./simulation";

afterEach(() => {
  vi.unstubAllGlobals();
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
    expect(readSimulation({ storage })).toEqual({
      region: { country: "US", region: "CA" },
      gpc: true,
    });
    clearSimulation(storage);
    expect(readSimulation({ storage })).toBeNull();
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
    expect(readSimulation({ storage: memory(raw) })).toBeNull();
  });

  it("drops unknown and prototype keys", () => {
    const raw =
      '{"__proto__":{"polluted":true},"region":{"country":"DE","extra":"x","__proto__":{"y":1}},"gpc":true,"script":"<img>"}';
    const read = readSimulation({ storage: memory(raw) });
    expect(read).toEqual({ region: { country: "DE" }, gpc: true });
    expect(Object.keys(read ?? {})).toEqual(["region", "gpc"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns null when storage throws", () => {
    expect(
      readSimulation({
        storage: {
          getItem() {
            throw new Error("blocked");
          },
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

  it("returns null in production even with valid stored data", () => {
    const storage = memory(
      '{"region":{"country":"US","region":"CA"},"gpc":false}',
    );
    vi.stubEnv("NODE_ENV", "production");
    const getItem = vi.spyOn(storage, "getItem");
    expect(readSimulation({ storage })).toBeNull();
    expect(readSimulation({ storage, allowProduction: false })).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("reads valid stored data in production with allowProduction", () => {
    const storage = memory(
      '{"region":{"country":"US","region":"CA"},"gpc":false}',
    );
    vi.stubEnv("NODE_ENV", "production");
    expect(readSimulation({ storage, allowProduction: true })).toEqual({
      region: { country: "US", region: "CA" },
      gpc: false,
    });
    expect(
      readSimulation({
        storage: memory('{"region":{"country":"<s>"}}'),
        allowProduction: true,
      }),
    ).toBeNull();
  });

  it("reads stored data in development without allowProduction", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(readSimulation({ storage: memory('{"gpc":true}') })).toEqual({
      gpc: true,
    });
  });

  describe("without process (script tag or CDN build)", () => {
    it("returns null and never reads storage, even with valid data", () => {
      const storage = memory(
        '{"region":{"country":"US","region":"CA"},"gpc":false}',
      );
      const getItem = vi.spyOn(storage, "getItem");
      const session = vi.fn();
      vi.stubGlobal("process", undefined);
      vi.stubGlobal("sessionStorage", {
        get getItem() {
          session();
          return () => null;
        },
      });
      expect(readSimulation({ storage })).toBeNull();
      expect(readSimulation()).toBeNull();
      expect(readSimulation({ storage, allowProduction: false })).toBeNull();
      vi.unstubAllGlobals();
      expect(getItem).not.toHaveBeenCalled();
      expect(session).not.toHaveBeenCalled();
    });

    it("still reads with allowProduction", () => {
      const storage = memory(
        '{"region":{"country":"US","region":"CA"},"gpc":false}',
      );
      vi.stubGlobal("process", undefined);
      const read = readSimulation({ storage, allowProduction: true });
      vi.unstubAllGlobals();
      expect(read).toEqual({
        region: { country: "US", region: "CA" },
        gpc: false,
      });
    });

    it("warns instead of throwing for an invalid write", () => {
      const storage = memory();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("process", undefined);
      const saved = writeSimulation(
        { region: { country: "x" } } as never,
        storage,
      );
      vi.unstubAllGlobals();
      expect(saved).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
      expect(storage.data.size).toBe(0);
    });
  });
});
