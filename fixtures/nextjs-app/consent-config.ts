import type { ConsentConfig } from "@cookiechimp/core";

export const consentConfig = {
  categories: { analytics: false, advertising: false },
  regulation: "gdpr",
  services: [
    {
      id: "analytics-demo",
      category: "analytics",
      domains: ["dynamic.cookiechimp.test"],
    },
  ],
  saleShareCategories: ["advertising"],
} satisfies ConsentConfig;
