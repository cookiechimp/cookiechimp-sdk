import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { localeMeta, translationReview } from "./meta";
import { tcfReviewedLocales } from "./tcf/index";

it("ties reviewed flags to the actual editorially reviewed source files", async () => {
  const evidence = JSON.parse(
    await readFile(new URL("../review.json", import.meta.url), "utf8"),
  );
  expect(evidence.review).toEqual(translationReview);
  expect(Object.keys(evidence.locales)).toEqual(Object.keys(localeMeta));
  for (const [locale, metadata] of Object.entries(localeMeta)) {
    expect(metadata.reviewed, locale).toBe(true);
    expect(tcfReviewedLocales).toContain(locale);
    for (const group of ["base", "tcf"] as const) {
      const relative = `${group === "base" ? "" : "tcf/"}${locale}.ts`;
      const text = await readFile(new URL(relative, import.meta.url));
      expect(createHash("sha256").update(text).digest("hex"), relative).toBe(
        evidence.locales[locale][group],
      );
    }
  }
});
