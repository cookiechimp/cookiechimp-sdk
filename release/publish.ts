import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { releaseVersion, validateManifest } from "./manifest.ts";
import {
  parseRegistryMetadata,
  type RegistryMetadata,
  verifyRegistryPublication,
} from "./registry.ts";

// This script is only entered after the workflow has checked main, CI,
// Daniel's environment review and publication prerequisites.
execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    resolve(import.meta.dirname, "check.ts"),
    "--publish",
  ],
  { stdio: "inherit" },
);
const directory = resolve(import.meta.dirname, "artifacts");
const manifest = JSON.parse(
  await readFile(join(directory, "manifest.json"), "utf8"),
);
if (
  process.env.APPROVED_RELEASE_VERSION !== manifest.version ||
  process.env.GITHUB_ACTIONS !== "true"
)
  throw new Error(
    "Publication requires GitHub Actions and approval of the exact release version",
  );
validateManifest(
  manifest,
  releaseVersion,
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: resolve(import.meta.dirname, ".."),
    encoding: "utf8",
  }).trim(),
);
for (const entry of manifest.packages) {
  const file = join(directory, entry.file);
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error(`Tarball changed: ${entry.name}`);
  // A partial rerun is allowed only when the existing registry bytes match.
  let existing: RegistryMetadata | undefined;
  try {
    existing = parseRegistryMetadata(
      execFileSync(
        "npm",
        [
          "view",
          `${entry.name}@${entry.version}`,
          "dist.integrity",
          "dist.attestations",
          "--json",
          "--registry=https://registry.npmjs.org",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
      ),
    );
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "");
    if (!/E404/.test(stderr)) throw error;
  }
  if (existing?.["dist.integrity"]) {
    if (
      existing["dist.integrity"] !== entry.integrity ||
      !existing["dist.attestations"]
    )
      throw new Error(
        `Existing version differs or has no provenance: ${entry.name}`,
      );
    console.log(`Verified already published: ${entry.name}@${entry.version}`);
    continue;
  }
  execFileSync(
    "npm",
    [
      "publish",
      file,
      "--access=public",
      "--provenance",
      "--tag=latest",
      "--ignore-scripts",
      "--registry=https://registry.npmjs.org",
    ],
    { stdio: "inherit" },
  );
  await verifyRegistryPublication(entry, () =>
    parseRegistryMetadata(
      execFileSync(
        "npm",
        [
          "view",
          `${entry.name}@${entry.version}`,
          "dist.integrity",
          "dist.attestations",
          "--json",
          "--registry=https://registry.npmjs.org",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
      ),
    ),
  );
}
