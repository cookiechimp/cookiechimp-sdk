import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeSection,
  encodeGpp,
  encodeSection,
  sectionFor,
  US_SECTIONS,
  type UsSectionName,
  type UsSectionValues,
  usValues,
} from "./gpp";
import type { ConsentState } from "./index";

const vectors = JSON.parse(
  readFileSync(
    new URL("./fixtures/gpp-2026-vectors.json", import.meta.url),
    "utf8",
  ),
) as {
  vectors: Array<{
    name: string;
    case: string;
    values: UsSectionValues;
    encoded: string;
  }>;
};

const states = [
  ["MN", "usmn", 23],
  ["MD", "usmd", 24],
  ["IN", "usin", 25],
  ["KY", "usky", 26],
  ["RI", "usri", 27],
] as const;

describe("GPP 2026 published section formats", () => {
  it.each(vectors.vectors)(
    "$name $case matches independent pinned-spec bytes",
    ({ name, values, encoded }) => {
      const section = name as UsSectionName;
      expect(encodeSection(section, values as UsSectionValues)).toBe(encoded);
      expect(decodeSection(section, encoded)).toMatchObject(values);
    },
  );

  it.each(states)(
    "routes %s to %s, with national mode remaining explicit",
    (state, name, id) => {
      expect(sectionFor({ country: "US", region: state })).toBe(name);
      expect(sectionFor({ country: "US", region: state }, "national")).toBe(
        "usnat",
      );
      expect(US_SECTIONS[name].id).toBe(id);
    },
  );

  it.each(states)(
    "%s keeps opt-outs fail-closed and honors GPC after acceptance",
    (_state, name) => {
      const accepted = {
        categories: { advertising: true, marketing: true },
        gpc: false,
      } as unknown as ConsentState;
      for (const [consent, gpc, expected] of [
        [null, false, 1],
        [accepted, false, 2],
        [accepted, true, 1],
      ] as const) {
        const encoded = encodeSection(name, usValues(name, consent, gpc));
        expect(decodeSection(name, encoded)).toMatchObject({
          SaleOptOut: expected,
          TargetedAdvertisingOptOut: expected,
        });
      }
    },
  );

  it("requires the current section header and rejects malformed subsection lists and payloads", () => {
    expect(decodeSection("usmd", "YBABY.BQAA.Q")).toMatchObject({
      Version: 1,
      SectionID: 24,
      SubSections: [1],
      MspaVersion: 1,
      Gpc: false,
    });
    for (const invalid of [
      "BQAA.QA", // Unpublished reference format has no required section header.
      "YBAA.BQAA.Q", // Header claims no extra subsection.
      "ZBABY.BQAA.Q", // Wrong jurisdiction.
      "YBABY.BQAA.Q.extra", // Undeclared extra subsection.
      "YBABY.BQAA.A", // Wrong GPC type.
      "YBABY.BQAA.R", // Nonzero padding.
      "YBABY.BQAAAA.Q", // Noncanonical length.
      "YBABY.BQAA.!", // Invalid alphabet.
      "YBABY.BAAA.Q", // Forbidden MSPA covered value zero.
    ])
      expect(decodeSection("usmd", invalid)).toBeNull();
    expect(decodeSection("usin", "ZBABY.BQAA.__8")).toBeNull();
    expect(decodeSection("usin", "ZBABY.BQAA.!")).toBeNull();
  });

  it("encodes all 21 sections without replacing any state with national", () => {
    const all = Object.fromEntries(
      Object.keys(US_SECTIONS).map((name) => [name, {}]),
    );
    expect(encodeGpp(all).split("~")).toHaveLength(22);
    expect(
      encodeGpp(Object.fromEntries(states.map(([, name]) => [name, {}]))).split(
        "~",
      ),
    ).toHaveLength(6);
  });

  it("preserves MSPA version and sensitive data assertions in modern subsections", () => {
    const values = {
      MspaVersion: 63,
      MspaCoveredTransaction: 2,
      MspaMode: 2,
      SensitiveDataProcessing: [0, 1, 2, 0, 1, 2, 0, 1],
      KnownChildSensitiveDataConsents: 2,
    };
    expect(decodeSection("usri", encodeSection("usri", values))).toMatchObject(
      values,
    );
    expect(
      decodeSection(
        "usky",
        encodeSection("usky", {
          MspaVersion: -1,
          MspaCoveredTransaction: 0,
          SensitiveDataProcessing: [3, -1, 2],
        }),
      ),
    ).toMatchObject({
      MspaVersion: 1,
      MspaCoveredTransaction: 1,
      SensitiveDataProcessing: [0, 0, 2, 0, 0, 0, 0, 0],
    });
  });
});
