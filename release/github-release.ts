import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { releaseVersion } from "./manifest.ts";

interface PublishedRelease {
  action?: string;
  release?: { draft?: boolean; prerelease?: boolean; tag_name?: string };
}

export function githubReleaseInputs(
  event: PublishedRelease,
  ref: string,
  source: string,
  main: string,
  version: string,
) {
  if (
    event.action !== "published" ||
    event.release?.draft !== false ||
    event.release?.prerelease !== false
  )
    throw new Error("Only a published stable release can publish npm latest");
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    event.release.tag_name !== `v${version}` ||
    ref !== `refs/tags/v${version}`
  )
    throw new Error("Release tag must match the coordinated package version");
  if (!/^[a-f0-9]{40}$/.test(source) || source !== main)
    throw new Error("Release must tag the current main commit");
  return {
    operation: "publish",
    approved_version: version,
    approved_source: source,
    release_tag: `v${version}`,
  };
}

export function verifyReleaseSource(
  source: string,
  tag: string,
  checkout: string,
  version: string,
) {
  if (!source && !tag) return false; // Existing manual prepare/publish flow.
  if (
    !/^[a-f0-9]{40}$/.test(source) ||
    source !== checkout ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    tag !== `v${version}`
  )
    throw new Error("Release tag and approved source must match this checkout");
  return true;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  if (process.argv[2] === "dispatch") {
    if (process.env.GITHUB_EVENT_NAME !== "release")
      throw new Error("Expected a GitHub release event");
    const inputs = githubReleaseInputs(
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")),
      process.env.GITHUB_REF ?? "",
      process.env.GITHUB_SHA ?? "",
      git("rev-parse", "HEAD"),
      releaseVersion,
    );
    execFileSync(
      "gh",
      [
        "workflow",
        "run",
        "release.yml",
        "--ref",
        "main",
        "--repo",
        process.env.GITHUB_REPOSITORY ?? "",
        ...Object.entries(inputs).flatMap(([key, value]) => [
          "-f",
          `${key}=${value}`,
        ]),
      ],
      { stdio: "inherit" },
    );
    console.log(
      `Started npm publication for ${inputs.release_tag} from ${inputs.approved_source}`,
    );
  } else if (process.argv[2] === "verify") {
    const source = process.env.APPROVED_RELEASE_SOURCE ?? "";
    const tag = process.env.RELEASE_TAG ?? "";
    if (
      verifyReleaseSource(source, tag, git("rev-parse", "HEAD"), releaseVersion)
    ) {
      git("fetch", "--no-tags", "origin", `refs/tags/${tag}`);
      if (git("rev-parse", "FETCH_HEAD^{commit}") !== source)
        throw new Error("Release tag moved after publication was requested");
      console.log(`Verified ${tag} at ${source}`);
    }
  } else throw new Error("Expected dispatch or verify");
}
