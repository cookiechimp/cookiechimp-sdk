import { GppModel, HeaderV1 as HeaderV1Ref } from "@iabgpp/cmpapi";
import { describe, expect, it } from "vitest";
import {
  decodeSection,
  encodeGpp,
  encodeHeader,
  encodeSection,
  sectionFor,
  US_SECTIONS,
  type UsSectionName,
  type UsSectionValues,
  usValues,
} from "./gpp";

// Published reference 3.2.0 covers section IDs 7 through 22.
const names = (Object.keys(US_SECTIONS) as UsSectionName[]).filter(
  (name) => US_SECTIONS[name].id <= 22,
);

// Deterministic PRNG so failures reproduce.
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

function randomValues(
  name: UsSectionName,
  next: () => number,
): UsSectionValues {
  const out: UsSectionValues = {};
  for (const [field, count] of US_SECTIONS[name].fields) {
    const pick = () =>
      field === "MspaCoveredTransaction"
        ? 1 + Math.floor(next() * 2)
        : Math.floor(next() * 3);
    out[field] = count ? Array.from({ length: count }, pick) : pick();
  }
  if (US_SECTIONS[name].gpc) out.Gpc = next() < 0.5;
  return out;
}

function reference(sections: Partial<Record<UsSectionName, UsSectionValues>>) {
  const model = new GppModel();
  for (const [name, values] of Object.entries(sections))
    for (const [field, value] of Object.entries(values ?? {}))
      model.setFieldValue(name, field, value);
  return model.encode();
}

describe("GPP encoder conformance with the IAB reference library", () => {
  it("matches field layouts from @iabgpp/cmpapi", async () => {
    const lib = await import("@iabgpp/cmpapi");
    const fieldNames = Object.fromEntries(
      names.map((name) => [
        name,
        lib[
          `${name.toUpperCase()}_CORE_SEGMENT_FIELD_NAMES` as keyof typeof lib
        ],
      ]),
    );
    for (const name of names)
      expect(["Version", ...US_SECTIONS[name].fields.map(([f]) => f)]).toEqual(
        fieldNames[name],
      );
  });

  it.each(names)(
    "%s encodes byte-identically to the reference for 200 random value sets",
    (name) => {
      const next = rng(US_SECTIONS[name].id);
      for (let i = 0; i < 200; i++) {
        const values = randomValues(name, next);
        const ours = encodeGpp({ [name]: values });
        expect(ours).toBe(reference({ [name]: values }));
        const decoded = new GppModel(ours).getSection(name) as UsSectionValues;
        for (const [field, value] of Object.entries(values))
          expect(decoded[field]).toEqual(value);
        expect(decodeSection(name, ours.split("~")[1] ?? "")).toMatchObject(
          values,
        );
      }
    },
  );

  it("encodes multi-section strings and every header ID combination like the reference", () => {
    const next = rng(42);
    for (let mask = 1; mask < 64; mask++) {
      const sections: Partial<Record<UsSectionName, UsSectionValues>> = {};
      names.forEach((name, bit) => {
        if (mask & (1 << bit)) sections[name] = randomValues(name, next);
      });
      expect(encodeGpp(sections)).toBe(reference(sections));
    }
    const all = Object.fromEntries(
      names.map((name) => [name, randomValues(name, next)]),
    );
    expect(encodeGpp(all)).toBe(reference(all));
    for (const first of names)
      for (const second of names) {
        const pair = {
          [first]: randomValues(first, next),
          [second]: randomValues(second, next),
        };
        expect(encodeGpp(pair)).toBe(reference(pair));
      }
    const lib = HeaderV1Ref;
    for (const ids of [
      [2],
      [2, 6],
      [2, 7, 8, 9, 10, 11, 12],
      [5, 6, 8],
      [1, 3, 5, 7],
    ]) {
      const header = new lib();
      header.setFieldValue("SectionIds", ids);
      expect(encodeHeader(ids)).toBe(header.encode());
    }
  });

  it("decodes strings produced by the reference library", () => {
    const next = rng(7);
    for (const name of names) {
      const values = randomValues(name, next);
      const encoded = reference({ [name]: values }).split("~")[1] ?? "";
      expect(decodeSection(name, encoded)).toMatchObject(values);
    }
  });

  it("matches the published IAB header example", () => {
    // Consent String Specification examples (6-bit padding); the reference
    // library and this encoder pad to a byte first, so only trailing zero
    // padding differs.
    expect(encodeHeader([2])).toMatch(/^DBABMA*$/);
    expect(encodeHeader([5, 6])).toMatch(/^DBABjwA*$/);
  });

  it("fails closed on invalid publisher values", () => {
    const encoded = encodeSection("usnat", {
      SaleOptOut: 7,
      MspaCoveredTransaction: 0,
      SensitiveDataProcessing: [9, -1],
    });
    expect(decodeSection("usnat", encoded)).toMatchObject({
      SaleOptOut: 0,
      MspaCoveredTransaction: 1,
      SensitiveDataProcessing: Array(16).fill(0),
    });
    expect(decodeSection("usnat", "!!")).toBeNull();
    expect(decodeSection("usnat", "BA")).toBeNull();
  });
});

describe("US section selection and consent mapping", () => {
  it("picks the state section, usnat elsewhere in the US, and none outside", () => {
    expect(sectionFor({ country: "US", region: "CA" })).toBe("usca");
    expect(sectionFor({ country: "US", region: "CT" })).toBe("usct");
    expect(sectionFor({ country: "US", region: "TX" })).toBe("ustx");
    expect(sectionFor({ country: "US", region: "NJ" })).toBe("usnj");
    expect(sectionFor({ country: "US", region: "OH" })).toBe("usnat");
    expect(sectionFor({ country: "US" })).toBe("usnat");
    expect(sectionFor({ country: "US", region: "CA" }, "national")).toBe(
      "usnat",
    );
    expect(sectionFor({ country: "IE" })).toBeNull();
    expect(sectionFor(null)).toBeNull();
  });

  it("maps granted marketing to did-not-opt-out and refusal to opted out", () => {
    const granted = { categories: { marketing: true } };
    expect(usValues("usnat", granted, false)).toMatchObject({
      SaleOptOut: 2,
      SharingOptOut: 2,
      TargetedAdvertisingOptOut: 2,
      Gpc: false,
    });
    expect(
      usValues("usnat", { categories: { marketing: false } }, false),
    ).toMatchObject({
      SaleOptOut: 1,
      SharingOptOut: 1,
      TargetedAdvertisingOptOut: 1,
    });
    expect(usValues("usca", granted, false)).not.toHaveProperty(
      "TargetedAdvertisingOptOut",
    );
    expect(usValues("usva", granted, false)).not.toHaveProperty("Gpc");
  });

  it("fails closed with no decision, a missing category, or GPC", () => {
    expect(usValues("usnat", null, false).SaleOptOut).toBe(1);
    expect(usValues("usnat", { categories: {} }, false).SaleOptOut).toBe(1);
    expect(
      usValues("usnat", { categories: { analytics: true } }, false).SaleOptOut,
    ).toBe(1);
    expect(
      usValues(
        "usnat",
        { categories: { advertising: true, marketing: false } },
        false,
      ).SaleOptOut,
    ).toBe(1);
    expect(
      usValues(
        "usnat",
        { categories: { advertising: true, marketing: true } },
        false,
      ).SaleOptOut,
    ).toBe(2);
    expect(
      usValues("usnat", { categories: { marketing: true } }, true),
    ).toMatchObject({
      SaleOptOut: 1,
      Gpc: true,
    });
    expect(
      usValues(
        "usnat",
        { categories: { marketing: true, ads: false } },
        false,
        {
          optOutCategories: ["marketing", "ads"],
        },
      ).SaleOptOut,
    ).toBe(1);
  });

  it("keeps publisher assertions but lets consent own the opt-out fields", () => {
    expect(
      usValues("usnat", { categories: { marketing: true } }, false, {
        values: {
          usnat: {
            SaleOptOutNotice: 1,
            SaleOptOut: 1,
            MspaServiceProviderMode: 2,
          },
        },
      }),
    ).toMatchObject({
      SaleOptOutNotice: 1,
      SaleOptOut: 2,
      MspaServiceProviderMode: 2,
    });
  });
});

it("ignores inherited section names and unrecognised region keys", () => {
  expect(encodeGpp(JSON.parse('{"__proto__":{},"constructor":{}}'))).toBe(
    encodeHeader([]),
  );
  expect(sectionFor({ country: "US", region: "constructor" })).toBe("usnat");
});
