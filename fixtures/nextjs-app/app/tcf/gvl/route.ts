// Fixture Global Vendor List subset. Real deployments load the GVL from the
// CookieChimp CDN; this keeps the e2e suite offline.
export function GET(request: Request) {
  if (new URL(request.url).searchParams.has("invalid"))
    return Response.json({ vendorListVersion: "x" });
  return Response.json({
    vendorListVersion: 150,
    tcfPolicyVersion: 5,
    vendors: {
      "1": {
        id: 1,
        purposes: [1, 2, 3, 4],
        legIntPurposes: [7],
        specialFeatures: [],
      },
      "2": { id: 2, purposes: [1, 8], legIntPurposes: [], specialFeatures: [] },
      "3": {
        id: 3,
        purposes: [1],
        legIntPurposes: [],
        specialFeatures: [],
        deletedDate: "2025-01-01",
      },
    },
  });
}
