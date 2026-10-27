import { expect, it } from "vitest";
import {
  packageNames,
  type ReleaseManifest,
  validateManifest,
} from "./manifest";

const sourceCommit = "a".repeat(40);
function candidate(version = "1.1.0"): ReleaseManifest {
  return {
    version,
    sourceCommit,
    packages: packageNames.map((name) => ({
      name: `@cookiechimp/${name}`,
      version,
      file: `cookiechimp-${name}-${version}.tgz`,
      sha256: "a".repeat(64),
      integrity: `sha512-${"A".repeat(86)}==`,
      files: 1,
    })),
  };
}

it("supports the next coordinated release without publishing an old candidate", () => {
  expect(() =>
    validateManifest(candidate(), "1.1.0", sourceCommit),
  ).not.toThrow();
  expect(() =>
    validateManifest(candidate("1.0.0"), "1.1.0", sourceCommit),
  ).toThrow("release version and source commit");
  expect(() =>
    validateManifest(candidate("1.2.0"), "1.2.0", sourceCommit),
  ).not.toThrow();
});

it("rejects a candidate from a different source commit", () => {
  expect(() => validateManifest(candidate(), "1.1.0", "b".repeat(40))).toThrow(
    "release version and source commit",
  );
});

it("rejects mixed versions, substituted paths and incomplete publication cohorts", () => {
  for (const update of [
    (value: ReleaseManifest) => {
      const first = value.packages[0];
      if (first) first.version = "1.0.0";
    },
    (value: ReleaseManifest) => {
      const first = value.packages[0];
      if (first) first.file = "../other.tgz";
    },
    (value: ReleaseManifest) => {
      value.packages.reverse();
    },
    (value: ReleaseManifest) => {
      value.packages.pop();
    },
  ]) {
    const value = candidate();
    update(value);
    expect(() => validateManifest(value, "1.1.0", sourceCommit)).toThrow();
  }
});

it("includes the native package after its core dependency in the coordinated cohort", () => {
  expect(packageNames).toHaveLength(9);
  expect(packageNames.indexOf("react-native")).toBeGreaterThan(
    packageNames.indexOf("core"),
  );
  const missingNative = candidate("1.2.0");
  missingNative.packages = missingNative.packages.filter(
    (entry) => entry.name !== "@cookiechimp/react-native",
  );
  expect(() => validateManifest(missingNative, "1.2.0", sourceCommit)).toThrow(
    "Unexpected publication cohort or order",
  );
});
