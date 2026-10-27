import { execFileSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  type ReleaseManifest,
  releaseVersion,
  validateManifest,
} from "./manifest.ts";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(import.meta.dirname, "native-consumer");
const artifacts = resolve(import.meta.dirname, "artifacts");
const manifest: ReleaseManifest = JSON.parse(
  await readFile(join(artifacts, "manifest.json"), "utf8"),
);
validateManifest(
  manifest,
  releaseVersion,
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
);
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
const example = join(root, "examples/react-native-expo");
for (const file of [
  "App.tsx",
  "index.ts",
  "app.json",
  "cookiechimp-config.json",
  "tsconfig.json",
])
  await copyFile(join(example, file), join(directory, file));
const source = JSON.parse(
  await readFile(join(example, "package.json"), "utf8"),
);
const core = manifest.packages.find(
  (entry: { name: string }) => entry.name === "@cookiechimp/core",
);
const native = manifest.packages.find(
  (entry: { name: string }) => entry.name === "@cookiechimp/react-native",
);
if (!core || !native)
  throw new Error("Native consumer requires both SDK tarballs");
const coreTarball = `file:${join(artifacts, core.file)}`;
source.name = "cookiechimp-packed-native-consumer";
source.dependencies[core.name] = coreTarball;
source.dependencies[native.name] = `file:${join(artifacts, native.file)}`;
source.overrides = { [core.name]: coreTarball };
source.scripts = { export: "expo export --platform ios --platform android" };
await writeFile(
  join(directory, "package.json"),
  `${JSON.stringify(source, null, 2)}\n`,
);
execFileSync(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--package-lock=false",
    "--no-audit",
    "--no-fund",
  ],
  { cwd: directory, stdio: "inherit" },
);
for (const entry of [core, native]) {
  const folder = join(directory, "node_modules", entry.name);
  if ((await lstat(folder)).isSymbolicLink())
    throw new Error("Native consumer resolved a workspace symlink");
  const installed = JSON.parse(
    await readFile(join(folder, "package.json"), "utf8"),
  );
  if (installed.version !== manifest.version)
    throw new Error(`Native consumer resolved another version: ${entry.name}`);
}
await writeFile(
  join(directory, "exports.ts"),
  'import * as sdk from "@cookiechimp/react-native"; void sdk;\n',
);
execFileSync(join(directory, "node_modules/.bin/tsc"), ["--noEmit"], {
  cwd: directory,
  stdio: "inherit",
});
// This is an offline packaging check. Device execution and live delivery are
// separate manual release gates, and this consumer must not submit records.
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
};
delete env.EXPO_PUBLIC_COOKIECHIMP_ACCOUNT_ID;
execFileSync(
  join(directory, "node_modules/.bin/expo"),
  ["export", "--platform", "ios", "--platform", "android"],
  { cwd: directory, stdio: "inherit", env },
);
const metadata = JSON.parse(
  await readFile(join(directory, "dist/metadata.json"), "utf8"),
);
for (const platform of ["ios", "android"]) {
  const bundle = metadata.fileMetadata?.[platform]?.bundle;
  if (
    typeof bundle !== "string" ||
    !(await lstat(join(directory, "dist", bundle))).isFile()
  )
    throw new Error(`Missing native Metro bundle: ${platform}`);
}
await writeFile(
  join(artifacts, "native-consumer-validation.json"),
  `${JSON.stringify(
    {
      version: manifest.version,
      sourceCommit: manifest.sourceCommit,
      packageCount: 2,
      installedTarballs: "passed",
      exampleAndExportTypes: "passed",
      iosMetroBundle: "passed",
      androidMetroBundle: "passed",
      deviceExecution: "pending",
      liveBackendDelivery: "pending",
    },
    null,
    2,
  )}\n`,
);
console.log(
  "Packed React Native consumer passed types and iOS/Android Metro exports",
);
