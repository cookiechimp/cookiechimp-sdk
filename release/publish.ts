import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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
const expected = [
  "tokens",
  "translations",
  "core",
  "react",
  "nextjs",
  "scripts",
  "devtools",
  "cli",
].map((name) => `@cookiechimp/${name}`);
if (
  manifest.version !== "1.0.0" ||
  process.env.APPROVED_RELEASE_VERSION !== manifest.version ||
  process.env.GITHUB_ACTIONS !== "true"
)
  throw new Error(
    "Publication requires GitHub Actions and approval of the exact release version",
  );
if (
  JSON.stringify(
    manifest.packages.map((entry: { name: string }) => entry.name),
  ) !== JSON.stringify(expected)
)
  throw new Error("Unexpected publication cohort or order");
for (const entry of manifest.packages) {
  if (
    !/^cookiechimp-[a-z]+-1\.0\.0\.tgz$/.test(entry.file) ||
    entry.version !== manifest.version
  )
    throw new Error("Invalid tarball identity");
  const file = join(directory, entry.file);
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error(`Tarball changed: ${entry.name}`);
  // A partial rerun is allowed only when the existing registry bytes match.
  let existing:
    | { "dist.integrity"?: string; "dist.attestations"?: unknown }
    | undefined;
  try {
    existing = JSON.parse(
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
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
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
  const published = JSON.parse(
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
      { encoding: "utf8" },
    ),
  );
  if (
    published["dist.integrity"] !== entry.integrity ||
    !published["dist.attestations"]
  )
    throw new Error(`Published version verification failed: ${entry.name}`);
}
