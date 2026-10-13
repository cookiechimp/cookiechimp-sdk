import { describe, expect, it } from "vitest";
import { localeMeta } from "../meta";
import t30 from "./ar";
import t17 from "./bg";
import t13 from "./cs";
import t10 from "./da";
import t1 from "./de";
import t18 from "./el";
import t0 from "./en";
import t3 from "./es";
import t21 from "./et";
import t11 from "./fi";
import t2 from "./fr";
import t24 from "./ga";
import t31 from "./he";
import t19 from "./hr";
import t15 from "./hu";
import { tcfMessageKeys, tcfReviewedLocales } from "./index";
import t4 from "./it";
import t27 from "./ja";
import t29 from "./ko";
import t23 from "./lt";
import t22 from "./lv";
import t25 from "./mt";
import t5 from "./nl";
import t12 from "./no";
import t8 from "./pl";
import t6 from "./pt";
import t7 from "./pt-BR";
import t16 from "./ro";
import t14 from "./sk";
import t20 from "./sl";
import t9 from "./sv";
import t26 from "./tr";
import t32 from "./uk";
import t28 from "./zh";

const locales = [
  ["en", t0],
  ["de", t1],
  ["fr", t2],
  ["es", t3],
  ["it", t4],
  ["nl", t5],
  ["pt", t6],
  ["pt-BR", t7],
  ["pl", t8],
  ["sv", t9],
  ["da", t10],
  ["fi", t11],
  ["no", t12],
  ["cs", t13],
  ["sk", t14],
  ["hu", t15],
  ["ro", t16],
  ["bg", t17],
  ["el", t18],
  ["hr", t19],
  ["sl", t20],
  ["et", t21],
  ["lv", t22],
  ["lt", t23],
  ["ga", t24],
  ["mt", t25],
  ["tr", t26],
  ["ja", t27],
  ["zh", t28],
  ["ko", t29],
  ["ar", t30],
  ["he", t31],
  ["uk", t32],
] as const;
const en = t0;
// Words that are the same in English and the target language.
const sameAsEnglish = new Set(["de:details", "nl:details"]);

describe("TCF labels", () => {
  it("cover every core locale with exactly the English keys", () => {
    expect(locales.map(([l]) => l)).toEqual(Object.keys(localeMeta));
    const expected = [...tcfMessageKeys].sort();
    expect(Object.keys(en).sort()).toEqual(expected);
    for (const [locale, labels] of locales) {
      expect(Object.keys(labels).sort(), locale).toEqual(expected);
      for (const value of Object.values(labels)) {
        expect(value.trim(), locale).not.toBe("");
        expect(value, locale).not.toContain("\u2014");
        expect(value, locale).not.toMatch(/<|>/u);
      }
    }
  });
  it("keep the {days} placeholder exactly once where English has it", () => {
    for (const [locale, labels] of locales)
      for (const key of tcfMessageKeys) {
        const count = (labels[key].match(/\{days\}/gu) ?? []).length;
        const want = (en[key].match(/\{days\}/gu) ?? []).length;
        expect(count, `${locale}:${key}`).toBe(want);
      }
  });
  it("contain real locale copy rather than English placeholders", () => {
    for (const [locale, labels] of locales.slice(1))
      for (const key of tcfMessageKeys) {
        if (sameAsEnglish.has(`${locale}:${key}`)) continue;
        expect(labels[key].toLocaleLowerCase(), `${locale}:${key}`).not.toBe(
          en[key].toLocaleLowerCase(),
        );
      }
  });
  it("mark only English as reviewed", () =>
    expect(tcfReviewedLocales).toEqual(["en"]));
});
