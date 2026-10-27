import { readFileSync } from "node:fs";

export const packageNames = [
  "tokens",
  "translations",
  "core",
  "react",
  "react-native",
  "nextjs",
  "scripts",
  "devtools",
  "cli",
] as const;

export const releaseVersion: string = JSON.parse(
  readFileSync(new URL("./readiness.json", import.meta.url), "utf8"),
).version;

export interface ReleaseManifest {
  version: string;
  sourceCommit: string;
  packages: {
    name: string;
    version: string;
    file: string;
    sha256: string;
    integrity: string;
    files: number;
  }[];
}

export function validateManifest(
  manifest: ReleaseManifest,
  version: string,
  sourceCommit: string,
): void {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    manifest.version !== version ||
    !/^[a-f0-9]{40}$/.test(sourceCommit) ||
    manifest.sourceCommit !== sourceCommit
  )
    throw new Error(
      "Candidate must match the release version and source commit",
    );
  if (
    !Array.isArray(manifest.packages) ||
    JSON.stringify(manifest.packages.map((entry) => entry.name)) !==
      JSON.stringify(packageNames.map((name) => `@cookiechimp/${name}`))
  )
    throw new Error("Unexpected publication cohort or order");
  for (const entry of manifest.packages)
    if (
      entry.version !== version ||
      entry.file !==
        `cookiechimp-${entry.name.slice("@cookiechimp/".length)}-${version}.tgz` ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity)
    )
      throw new Error(`Invalid tarball identity or hashes: ${entry.name}`);
}
