import { TCString } from "@iabtcf/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PURPOSES,
  encodeTcString,
  encodeVendors,
  type Gvl,
  parseGvl,
  resolveCmpId,
  type TcModel,
  tcModelFor,
} from "./tcf";

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}
const pick = (next: () => number, max: number, density: number) => {
  const set = new Set<number>();
  for (let id = 1; id <= max; id++) if (next() < density) set.add(id);
  return set;
};
const values = (vector: {
  forEach(cb: (v: boolean, id: number) => void): void;
}) => {
  const out: number[] = [];
  vector.forEach((value, id) => {
    if (value) out.push(id);
  });
  return out;
};
const sorted = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b);

function randomModel(next: () => number): TcModel {
  const maxVendor = 1 + Math.floor(next() * 1200);
  const density = [0.02, 0.5, 0.98][Math.floor(next() * 3)] as number;
  return {
    cmpId: 2 + Math.floor(next() * 4000),
    cmpVersion: Math.floor(next() * 4096),
    consentScreen: Math.floor(next() * 64),
    consentLanguage: ["EN", "FR", "DE", "GA"][Math.floor(next() * 4)] as string,
    vendorListVersion: 1 + Math.floor(next() * 4000),
    tcfPolicyVersion: 4 + Math.floor(next() * 2),
    updated: Date.UTC(
      2026,
      Math.floor(next() * 12),
      1 + Math.floor(next() * 28),
    ),
    useNonStandardTexts: next() < 0.5,
    purposeOneTreatment: next() < 0.5,
    publisherCC: ["IE", "DE", "AA"][Math.floor(next() * 3)] as string,
    specialFeatureOptins: pick(next, 2, 0.5),
    purposeConsents: pick(next, 11, 0.5),
    purposeLegitimateInterests: pick(next, 11, 0.5),
    vendorConsents: pick(next, maxVendor, density),
    vendorLegitimateInterests: pick(next, maxVendor, density),
    disclosedVendors: pick(next, maxVendor, density),
    ...(next() < 0.5
      ? {
          publisherConsents: pick(next, 11, 0.5),
          publisherLegitimateInterests: pick(next, 11, 0.5),
        }
      : {}),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("TC string conformance with the IAB reference decoder (@iabtcf/core)", () => {
  it("decodes 300 random models to identical fields", () => {
    const next = rng(26);
    for (let i = 0; i < 300; i++) {
      const model = randomModel(next);
      const encoded = encodeTcString(model);
      const decoded = TCString.decode(encoded);
      expect(decoded.version).toBe(2);
      expect(decoded.cmpId).toBe(model.cmpId);
      expect(decoded.cmpVersion).toBe(model.cmpVersion);
      expect(decoded.consentScreen).toBe(model.consentScreen);
      expect(decoded.consentLanguage).toBe(model.consentLanguage);
      expect(decoded.vendorListVersion).toBe(model.vendorListVersion);
      expect(decoded.policyVersion).toBe(model.tcfPolicyVersion);
      expect(decoded.isServiceSpecific).toBe(true);
      expect(decoded.useNonStandardStacks).toBe(model.useNonStandardTexts);
      expect(decoded.purposeOneTreatment).toBe(model.purposeOneTreatment);
      expect(decoded.publisherCountryCode).toBe(model.publisherCC);
      expect(decoded.created?.getTime()).toBe(model.updated);
      expect(decoded.lastUpdated?.getTime()).toBe(model.updated);
      expect(values(decoded.specialFeatureOptins)).toEqual(
        sorted(model.specialFeatureOptins),
      );
      expect(values(decoded.purposeConsents)).toEqual(
        sorted(model.purposeConsents),
      );
      expect(values(decoded.purposeLegitimateInterests)).toEqual(
        sorted(model.purposeLegitimateInterests).filter(
          (id) => id < 3 || id > 6,
        ),
      );
      expect(values(decoded.vendorConsents)).toEqual(
        sorted(model.vendorConsents),
      );
      expect(values(decoded.vendorLegitimateInterests)).toEqual(
        sorted(model.vendorLegitimateInterests),
      );
      expect(values(decoded.vendorsDisclosed)).toEqual(
        sorted(model.disclosedVendors),
      );
      if (model.publisherConsents) {
        expect(values(decoded.publisherConsents)).toEqual(
          sorted(model.publisherConsents),
        );
        expect(values(decoded.publisherLegitimateInterests)).toEqual(
          sorted(model.publisherLegitimateInterests ?? new Set()),
        );
      }
      expect(encoded.split(".").length).toBe(model.publisherConsents ? 3 : 2);
    }
  });

  it("always emits the mandatory disclosed vendors segment, even when empty", () => {
    const model = randomModel(rng(1));
    const encoded = encodeTcString({ ...model, disclosedVendors: new Set() });
    expect(encoded.split(".")).toHaveLength(model.publisherConsents ? 3 : 2);
    expect(values(TCString.decode(encoded).vendorsDisclosed)).toEqual([]);
  });

  it("picks the shorter vendor encoding", () => {
    const dense = new Set(Array.from({ length: 900 }, (_, i) => i + 1));
    expect(encodeVendors(dense).length).toBe(16 + 1 + 12 + 1 + 32);
    expect(encodeVendors(new Set([1, 3])).length).toBe(16 + 1 + 3);
    expect(encodeVendors(new Set())).toBe(`${"0".repeat(16)}0`);
  });
});

const gvl: Gvl = {
  vendorListVersion: 150,
  tcfPolicyVersion: 5,
  vendors: {
    "1": {
      id: 1,
      purposes: [1, 2, 3, 4],
      legIntPurposes: [7],
      specialFeatures: [],
    },
    "2": { id: 2, purposes: [1, 8], legIntPurposes: [], specialFeatures: [] },
    "3": { id: 3, purposes: [1, 2], legIntPurposes: [], specialFeatures: [1] },
    "4": {
      id: 4,
      purposes: [1],
      legIntPurposes: [],
      specialFeatures: [],
      deletedDate: "2025-01-01",
    },
  },
};
const base = {
  cmpId: 300,
  cmpVersion: 2,
  consentScreen: 1,
  consentLanguage: "en",
  publisherCC: "IE",
};

describe("tcModelFor", () => {
  it("fails closed with no decision: LI transparency only, no consents", () => {
    const model = tcModelFor(null, gvl, base);
    expect(sorted(model.purposeConsents)).toEqual([]);
    expect(sorted(model.vendorConsents)).toEqual([]);
    expect(sorted(model.vendorLegitimateInterests)).toEqual([1]);
    expect(sorted(model.disclosedVendors)).toEqual([1, 2, 3]);
    expect(sorted(model.purposeLegitimateInterests)).toEqual([
      2, 7, 8, 9, 10, 11,
    ]);
  });

  it("grants vendors only when all their consent purposes and special features are granted", () => {
    const ts = "2026-10-13T15:42:10.000Z";
    const marketing = tcModelFor(
      { categories: { marketing: true }, ts },
      gvl,
      base,
    );
    expect(sorted(marketing.purposeConsents)).toEqual(
      [...(DEFAULT_PURPOSES.marketing ?? [])].sort((a, b) => a - b),
    );
    expect(sorted(marketing.vendorConsents)).toEqual([1]);
    expect(marketing.updated).toBe(Date.UTC(2026, 9, 13));
    const all = tcModelFor(
      { categories: { marketing: true, analytics: true }, ts },
      gvl,
      base,
      {
        specialFeatures: { marketing: [1] },
      },
    );
    expect(sorted(all.vendorConsents)).toEqual([1, 2, 3]);
    expect(sorted(all.specialFeatureOptins)).toEqual([1]);
  });

  it("limits disclosure to the publisher vendor list and honours custom mappings", () => {
    const model = tcModelFor(
      { categories: { ads: true, marketing: true }, ts: "" },
      gvl,
      base,
      {
        vendors: [2, 3, 99],
        purposes: { marketing: null, ads: [1, 2] },
      },
    );
    expect(sorted(model.disclosedVendors)).toEqual([2, 3]);
    expect(sorted(model.purposeConsents)).toEqual([1, 2]);
    expect(sorted(model.vendorConsents)).toEqual([]);
  });
});

describe("parseGvl", () => {
  it("rejects invalid lists and drops malformed vendors", () => {
    expect(parseGvl(null)).toBeNull();
    expect(
      parseGvl({ vendorListVersion: 1, tcfPolicyVersion: 3, vendors: {} }),
    ).toBeNull();
    expect(
      parseGvl({ vendorListVersion: "1", tcfPolicyVersion: 5, vendors: {} }),
    ).toBeNull();
    const parsed = parseGvl({
      vendorListVersion: 3,
      tcfPolicyVersion: 5,
      vendors: {
        "1": { id: 1, purposes: [1], legIntPurposes: [2] },
        "2": { id: 3, purposes: [1], legIntPurposes: [] },
        "4": { id: 4, purposes: [99], legIntPurposes: [] },
        __proto__: { id: 5 },
      },
    });
    expect(Object.keys(parsed?.vendors ?? {})).toEqual(["1"]);
  });
});

describe("resolveCmpId", () => {
  it("defaults a missing cmpId to 0 in development with a warning", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveCmpId(undefined)).toBe(0);
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /cmpId is not set, using 0 in development only/,
    );
  });

  it("throws on an invalid cmpId in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => resolveCmpId(-1)).toThrow(/invalid cmpId/);
    expect(() => resolveCmpId(1.5)).toThrow(TypeError);
    expect(() => resolveCmpId("300")).toThrow(TypeError);
    expect(resolveCmpId(300)).toBe(300);
  });

  it("disables TCF in production when cmpId is missing, 0, or invalid", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveCmpId(undefined)).toBeNull();
    expect(resolveCmpId(0)).toBeNull();
    expect(resolveCmpId(5000)).toBeNull();
    expect(error).toHaveBeenCalledTimes(3);
    expect(resolveCmpId(300)).toBe(300);
  });

  it("treats a missing process as production", () => {
    const original = globalThis.process;
    vi.spyOn(console, "error").mockImplementation(() => {});
    // @ts-expect-error simulate a browser without process
    delete globalThis.process;
    try {
      expect(resolveCmpId(undefined)).toBeNull();
    } finally {
      globalThis.process = original;
    }
  });
});
