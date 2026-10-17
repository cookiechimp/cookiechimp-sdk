import { expect, it } from "vitest";
import { type PublicationState, publicationBlockers } from "./readiness";

const ready: PublicationState = {
  version: "1.0.0",
  approvedVersion: "1.0.0",
  repositoryVisibility: "public",
  manualChecks: {
    platformDeployed: true,
    publicHistoryReviewed: true,
    npmOrganizationReady: true,
  },
  locales: { en: { reviewed: true } },
  tcfLocales: ["en"],
  reviewedTcfLocales: ["en"],
};

it("blocks publication until every standalone prerequisite is satisfied", () => {
  expect(
    publicationBlockers({
      ...ready,
      repositoryVisibility: "private",
      approvedVersion: "",
      manualChecks: {},
    }),
  ).toEqual([
    "A public source repository is required for npm provenance",
    "Daniel must explicitly approve publication of this exact version",
    "Manual check required: publicHistoryReviewed",
    "Manual check required: npmOrganizationReady",
  ]);
  expect(publicationBlockers(ready)).toEqual([]);
});

it("permits standalone publication without claiming live platform verification", () => {
  const state = {
    ...ready,
    manualChecks: { ...ready.manualChecks, platformDeployed: false },
  };
  expect(publicationBlockers(state)).toEqual([]);
  expect(state.manualChecks.platformDeployed).toBe(false);
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

it("permits SDK publication while optional IAB integration work is deferred", () => {
  expect(
    publicationBlockers({
      ...ready,
      manualChecks: { ...ready.manualChecks, iabValidated: false },
    }),
  ).toEqual([]);
});
