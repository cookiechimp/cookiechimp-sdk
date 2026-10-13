// Fixture Global Vendor List subset. Real deployments load the GVL from the
// CookieChimp CDN; this keeps the e2e suite offline.
export function GET(request: Request) {
  if (new URL(request.url).searchParams.has("invalid"))
    return Response.json({ vendorListVersion: "x" });
  if (new URL(request.url).searchParams.has("large")) {
    const vendors: Record<string, unknown> = {};
    for (let id = 1; id <= 1200; id++)
      vendors[id] = {
        id,
        name: `Partner ${id}`,
        purposes: [1, 2],
        legIntPurposes: id % 2 ? [7] : [],
        specialFeatures: [],
        dataRetention: { stdRetention: 30, purposes: {}, specialPurposes: {} },
        urls: [
          {
            langId: "en",
            privacy: `https://partner${id}.example/privacy`,
            ...(id % 2
              ? { legIntClaim: `https://partner${id}.example/li` }
              : {}),
          },
        ],
        usesCookies: true,
        cookieMaxAgeSeconds: 86400 * 90,
        cookieRefresh: false,
        usesNonCookieAccess: id % 3 === 0,
        deviceStorageDisclosureUrl: `https://partner${id}.example/storage.json`,
      };
    return Response.json({
      vendorListVersion: 151,
      tcfPolicyVersion: 5,
      purposes: {
        "1": { name: "Store and/or access information on a device" },
        "2": { name: "Use limited data to select advertising" },
        "7": { name: "Measure advertising performance" },
      },
      vendors,
    });
  }
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
