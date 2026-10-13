import { expect, it } from "vitest";
import { type PublicationState, publicationBlockers } from "./readiness";

const ready: PublicationState = {
  version: "1.0.0",
  approvedVersion: "1.0.0",
  repositoryVisibility: "public",
  manualChecks: {
    platformDeployed: true,
    iabValidated: true,
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
it("cannot replace native review with an approval flag", () => {
  expect(
    publicationBlockers({
      ...ready,
      locales: { de: { reviewed: false } },
      tcfLocales: ["de"],
    }),
  ).toEqual([
    "Native review pending for base locales: de",
    "Native review pending for TCF locales: de",
  ]);
});
