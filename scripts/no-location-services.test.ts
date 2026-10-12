import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const forbidden = [
  "ipapi",
  "ipinfo",
  "geoip",
  "geolocation",
  "ip-api",
  "freegeoip",
];

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

describe("published SDK location privacy", () => {
  for (const name of ["core", "react", "nextjs", "scripts", "devtools"]) {
    it(`${name} dist contains no location-service references`, () => {
      const dist = resolve(`packages/${name}/dist`);
      expect(existsSync(dist), `${dist} must be built before this test`).toBe(
        true,
      );
      const matches = filesBelow(dist).flatMap((file) => {
        const source = readFileSync(file, "utf8").toLowerCase();
        return forbidden
          .filter((term) => source.includes(term))
          .map((term) => `${file}: ${term}`);
      });
      expect(matches).toEqual([]);
    });
  }

  for (const entry of ["pages", "middleware", "styles-route"]) {
    it(`nextjs ${entry} distribution entry contains no location-service references`, () => {
      for (const extension of ["mjs", "cjs"]) {
        const file = resolve(`packages/nextjs/dist/${entry}.${extension}`);
        expect(existsSync(file), `${file} must be built before this test`).toBe(
          true,
        );
        const source = readFileSync(file, "utf8").toLowerCase();
        expect(forbidden.filter((term) => source.includes(term))).toEqual([]);
      }
    });
  }
});
