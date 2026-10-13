import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const packageNames = [
  "tokens",
  "translations",
  "core",
  "react",
  "nextjs",
  "scripts",
  "devtools",
  "cli",
] as const;
const root = resolve(import.meta.dirname, "..");
const out = resolve(root, process.argv[2] ?? "release/artifacts");
// Always build the exact current source before packing, including after rebases.
execFileSync(
  "pnpm",
  [
    "exec",
    "turbo",
    "run",
    "build",
    ...packageNames.map((name) => `--filter=@cookiechimp/${name}`),
  ],
  { cwd: root, stdio: "inherit" },
);
await mkdir(out, { recursive: true });
const packages: {
  name: string;
  version: string;
  file: string;
  sha256: string;
  integrity: string;
  files: number;
}[] = [];
const outputs = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "object" && value !== null)
    return Object.values(value).flatMap(outputs);
  return [];
};
for (const name of packageNames) {
  const directory = join(root, "packages", name);
  const source = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  if (
    source.private ||
    source.version !== "1.0.0" ||
    source.license !== "MIT" ||
    source.publishConfig?.access !== "public"
  )
    throw new Error(`Invalid release metadata: ${name}`);
  const filename = `cookiechimp-${name}-${source.version}.tgz`;
  const tarball = join(out, filename);
  execFileSync("pnpm", ["pack", "--out", tarball], {
    cwd: directory,
    stdio: "pipe",
  });
  const paths = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" })
    .trim()
    .split("\n");
  const files = new Set(paths);
  for (const path of paths) {
    if (
      !/^package\/(?:dist\/[A-Za-z0-9_./-]+|(?:package\.json|README\.md|LICENSE|CHANGELOG\.md|styles\.css|tcf\.css|styles\.d\.ts))$/.test(
        path,
      ) ||
      path.includes("..")
    )
      throw new Error(`Unexpected package file: ${path}`);
  }
  const packed = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  for (const dependency of [packed.dependencies, packed.peerDependencies])
    for (const version of Object.values(dependency ?? {}))
      if (
        typeof version !== "string" ||
        /^(?:workspace:|file:|link:)/.test(version)
      )
        throw new Error(`Unresolved dependency in ${name}`);
  for (const target of [
    ...outputs(packed.exports),
    ...outputs(packed.bin),
    packed.main,
    packed.module,
    packed.types,
  ].filter(Boolean))
    if (!files.has(`package/${String(target).replace(/^\.\//, "")}`))
      throw new Error(`Missing export ${name}: ${target}`);
  for (const required of [
    "package/LICENSE",
    "package/README.md",
    "package/CHANGELOG.md",
  ])
    if (!files.has(required))
      throw new Error(`Missing release documentation ${name}: ${required}`);
  const bytes = await readFile(tarball);
  packages.push({
    name: packed.name,
    version: packed.version,
    file: filename,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    files: paths.length,
  });
}
await writeFile(
  join(out, "manifest.json"),
  `${JSON.stringify({ version: "1.0.0", packages }, null, 2)}\n`,
);
console.log(`Validated ${packages.length} tarballs in ${out}`);
