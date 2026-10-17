export interface PublicationState {
  manualChecks: Record<string, boolean>;
  locales: Record<string, { reviewed: boolean }>;
  tcfLocales: readonly string[];
  reviewedTcfLocales: readonly string[];
  repositoryVisibility: string;
  approvedVersion: string;
  version: string;
}

export function publicationBlockers(state: PublicationState): string[] {
  const blockers: string[] = [];
  if (state.repositoryVisibility !== "public")
    blockers.push("A public source repository is required for npm provenance");
  if (state.approvedVersion !== state.version)
    blockers.push(
      "Daniel must explicitly approve publication of this exact version",
    );
  // Live platform delivery and optional managed IAB activation are tracked
  // separately in readiness.json. Neither is required to use the standalone SDK.
  // Do not mark those integrations verified merely to publish npm packages.
  for (const name of ["publicHistoryReviewed", "npmOrganizationReady"])
    if (state.manualChecks[name] !== true)
      blockers.push(`Manual check required: ${name}`);
  const drafts = Object.entries(state.locales)
    .filter(([, metadata]) => !metadata.reviewed)
    .map(([locale]) => locale);
  if (drafts.length)
    blockers.push(
      `Editorial review pending for base locales: ${drafts.join(", ")}`,
    );
  const reviewed = new Set(state.reviewedTcfLocales);
  const tcfDrafts = state.tcfLocales.filter((locale) => !reviewed.has(locale));
  if (tcfDrafts.length)
    blockers.push(
      `Editorial review pending for TCF locales: ${tcfDrafts.join(", ")}`,
    );
  return blockers;
}
