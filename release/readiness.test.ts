import { expect, it } from "vitest";
import { type PublicationState, publicationBlockers } from "./readiness";

const ready: PublicationState = {
  version: "1.1.0",
  approvedVersion: "1.1.0",
  repositoryVisibility: "public",
  manualChecks: {
    platformDeployed: true,
    nativeDevicesVerified: true,
    publicHistoryReviewed: true,
    npmOrganizationReady: true,
  },
  locales: { en: { reviewed: true } },
  tcfLocales: ["en"],
  reviewedTcfLocales: ["en"],
};

it("blocks publication until every real prerequisite is satisfied", () => {
  expect(
    publicationBlockers({
      ...ready,
      repositoryVisibility: "private",
      approvedVersion: "",
      manualChecks: {},
    }),
  ).toHaveLength(6);
  expect(publicationBlockers(ready)).toEqual([]);
});
it("cannot replace editorial review with a publication approval", () => {
  expect(
    publicationBlockers({
      ...ready,
      locales: { de: { reviewed: false } },
      tcfLocales: ["de"],
    }),
  ).toEqual([
    "Editorial review pending for base locales: de",
    "Editorial review pending for TCF locales: de",
  ]);
});

it("does not reuse the 1.0.0 publication approval for the next release", () => {
  expect(publicationBlockers({ ...ready, approvedVersion: "1.0.0" })).toEqual([
    "Daniel must explicitly approve publication of this exact version",
  ]);
});

it("requires live platform verification even when standalone usage is possible", () => {
  expect(
    publicationBlockers({
      ...ready,
      manualChecks: { ...ready.manualChecks, platformDeployed: false },
    }),
  ).toEqual(["Manual check required: platformDeployed"]);
});

it("permits SDK publication while optional IAB integration work is deferred", () => {
  expect(
    publicationBlockers({
      ...ready,
      manualChecks: { ...ready.manualChecks, iabValidated: false },
    }),
  ).toEqual([]);
});

it("requires native device validation for the React Native release", () => {
  expect(
    publicationBlockers({
      ...ready,
      manualChecks: { ...ready.manualChecks, nativeDevicesVerified: false },
    }),
  ).toEqual(["Manual check required: nativeDevicesVerified"]);
});
