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
  for (const name of ["core", "react", "nextjs"]) {
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
});
