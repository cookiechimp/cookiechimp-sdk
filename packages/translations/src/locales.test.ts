import { describe, expect, it } from "vitest";
import l30 from "./ar";
import l17 from "./bg";
import l13 from "./cs";
import l10 from "./da";
import l1 from "./de";
import l18 from "./el";
import l0 from "./en";
import l3 from "./es";
import l21 from "./et";
import l11 from "./fi";
import l2 from "./fr";
import l24 from "./ga";
import l31 from "./he";
import l19 from "./hr";
import l15 from "./hu";
import { messageKeys, rtlLocales } from "./index";
import l4 from "./it";
import l27 from "./ja";
import l29 from "./ko";
import l23 from "./lt";
import l22 from "./lv";
import { localeMeta } from "./meta";
import l25 from "./mt";
import l5 from "./nl";
import l12 from "./no";
import l8 from "./pl";
import l6 from "./pt";
import l7 from "./pt-BR";
import l16 from "./ro";
import l14 from "./sk";
import l20 from "./sl";
import l9 from "./sv";
import l26 from "./tr";
import l32 from "./uk";
import l28 from "./zh";

const locales = [
  ["en", l0],
  ["de", l1],
  ["fr", l2],
  ["es", l3],
  ["it", l4],
  ["nl", l5],
  ["pt", l6],
  ["pt-BR", l7],
  ["pl", l8],
  ["sv", l9],
  ["da", l10],
  ["fi", l11],
  ["no", l12],
  ["cs", l13],
  ["sk", l14],
  ["hu", l15],
  ["ro", l16],
  ["bg", l17],
  ["el", l18],
  ["hr", l19],
  ["sl", l20],
  ["et", l21],
  ["lv", l22],
  ["lt", l23],
  ["ga", l24],
  ["mt", l25],
  ["tr", l26],
  ["ja", l27],
  ["zh", l28],
  ["ko", l29],
  ["ar", l30],
  ["he", l31],
  ["uk", l32],
] as const;
describe("translation locales", () => {
  it("give every locale exactly the non-empty English reference keys", () => {
    const expected = Object.keys(l0).sort();
    expect(locales.length).toBeGreaterThanOrEqual(30);
    for (const [locale, messages] of locales) {
      expect(Object.keys(messages).sort(), locale).toEqual(expected);
      for (const value of Object.values(messages)) {
        expect(value.trim(), locale).not.toBe("");
        expect(value, locale).not.toContain("\u2014");
      }
    }
    expect(expected).toEqual([...messageKeys].sort());
  });
  it("marks right-to-left locales", () =>
    expect(rtlLocales).toEqual(["ar", "he"]));
  it("contains real locale copy rather than English placeholders", () => {
    const permittedEnglish = new Set(["category.marketing.name:Marketing"]);
    for (const [locale, messages] of locales.slice(1)) {
      for (const key of messageKeys) {
        const value = messages[key];
        const source = l0[key];
        expect(value, `${locale}:${key}`).not.toMatch(/\s\([^)]+\)$/u);
        if (!permittedEnglish.has(`${key}:${source}`)) {
          expect(value.toLocaleLowerCase(), `${locale}:${key}`).not.toBe(
            source.toLocaleLowerCase(),
          );
          if (source.length >= 12)
            expect(value.toLocaleLowerCase(), `${locale}:${key}`).not.toContain(
              source.toLocaleLowerCase(),
            );
        }
      }
    }
  });
  it("tracks review status and direction for every locale", () => {
    expect(Object.keys(localeMeta)).toEqual(locales.map(([locale]) => locale));
    expect(
      Object.entries(localeMeta)
        .filter(([, metadata]) => metadata.reviewed)
        .map(([locale]) => locale),
    ).toEqual(["en", "de", "fr", "es"]);
    expect(localeMeta.ar.dir).toBe("rtl");
    expect(localeMeta.he.dir).toBe("rtl");
  });
});
