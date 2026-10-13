import { readFile } from "node:fs/promises";
import { localeMeta } from "../packages/translations/src/meta.ts";
import { tcfReviewedLocales } from "../packages/translations/src/tcf/index.ts";
import { publicationBlockers } from "./readiness.ts";

const readiness = JSON.parse(
  await readFile(new URL("./readiness.json", import.meta.url), "utf8"),
);
const blockers = publicationBlockers({
  ...readiness,
  locales: localeMeta,
  tcfLocales: Object.keys(localeMeta),
  reviewedTcfLocales: tcfReviewedLocales,
  repositoryVisibility: process.env.SDK_REPOSITORY_VISIBILITY ?? "unknown",
  approvedVersion: process.env.APPROVED_RELEASE_VERSION ?? "",
});
for (const blocker of blockers) console.log(`Pending: ${blocker}`);
if (process.argv.includes("--publish") && blockers.length) process.exitCode = 1;
if (!blockers.length)
  console.log(`Publication prerequisites satisfied for ${readiness.version}`);
