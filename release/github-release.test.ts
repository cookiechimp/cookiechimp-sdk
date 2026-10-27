import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { githubReleaseInputs, verifyReleaseSource } from "./github-release";
import { releaseVersion } from "./manifest";

const source = "a".repeat(40);
const published = {
  action: "published",
  release: { tag_name: "v1.2.0", draft: false, prerelease: false },
};
const request = (event = published, ref = "refs/tags/v1.2.0", main = source) =>
  githubReleaseInputs(event, ref, source, main, "1.2.0");

it("routes a stable GitHub release to the existing main-only publishing workflow", () => {
  expect(request()).toEqual({
    operation: "publish",
    approved_version: "1.2.0",
    approved_source: source,
    release_tag: "v1.2.0",
  });
});

it("does not publish drafts, prereleases or release edits as npm latest", () => {
  for (const event of [
    { ...published, action: "edited" },
    { ...published, release: { ...published.release, draft: true } },
    { ...published, release: { ...published.release, prerelease: true } },
  ])
    expect(() => request(event)).toThrow("published stable release");
});

it("rejects a mismatched tag, branch ref or commit outside the current main tip", () => {
  expect(() =>
    request({
      ...published,
      release: { ...published.release, tag_name: "v1.1.0" },
    }),
  ).toThrow("coordinated package version");
  expect(() => request(published, "refs/heads/main")).toThrow(
    "coordinated package version",
  );
  expect(() => request(published, "refs/tags/v1.2.0", "b".repeat(40))).toThrow(
    "current main commit",
  );
});

it("preserves manual prepare and recovery while binding release publication to its source", () => {
  expect(verifyReleaseSource("", "", source, "1.2.0")).toBe(false);
  expect(verifyReleaseSource(source, "v1.2.0", source, "1.2.0")).toBe(true);
  for (const [sha, tag, checkout] of [
    [source, "", source],
    ["", "v1.2.0", source],
    [source, "v1.1.0", source],
    [source, "v1.2.0", "b".repeat(40)],
  ])
    expect(() =>
      verifyReleaseSource(sha ?? "", tag ?? "", checkout ?? "", "1.2.0"),
    ).toThrow("approved source");
});

it("dispatches the main-only workflow with the exact released version and source", () => {
  const directory = mkdtempSync(join(tmpdir(), "sdk-release-trigger-"));
  const root = resolve(import.meta.dirname, "..");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const capture = join(directory, "arguments.json");
  const event = join(directory, "event.json");
  writeFileSync(
    event,
    JSON.stringify({
      ...published,
      release: { ...published.release, tag_name: `v${releaseVersion}` },
    }),
  );
  writeFileSync(
    join(directory, "gh"),
    `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.RELEASE_DISPATCH_CAPTURE, JSON.stringify(process.argv.slice(2)));
`,
    { mode: 0o755 },
  );
  try {
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(root, "release/github-release.ts"),
        "dispatch",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          RELEASE_DISPATCH_CAPTURE: capture,
          GITHUB_EVENT_NAME: "release",
          GITHUB_EVENT_PATH: event,
          GITHUB_REF: `refs/tags/v${releaseVersion}`,
          GITHUB_SHA: sha,
          GITHUB_REPOSITORY: "cookiechimp/cookiechimp-sdk",
        },
        stdio: "pipe",
      },
    );
    expect(JSON.parse(readFileSync(capture, "utf8"))).toEqual([
      "workflow",
      "run",
      "release.yml",
      "--ref",
      "main",
      "--repo",
      "cookiechimp/cookiechimp-sdk",
      "-f",
      "operation=publish",
      "-f",
      `approved_version=${releaseVersion}`,
      "-f",
      `approved_source=${sha}`,
      "-f",
      `release_tag=v${releaseVersion}`,
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
