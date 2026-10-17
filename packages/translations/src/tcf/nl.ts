import type { TcfMessages } from "./index";

const labels = {
  title: "Partners en doeleinden",
  purposes: "Doeleinden",
  specialFeatures: "Speciale functies",
  vendors: "Leveranciers",
  search: "Leveranciers zoeken",
  consent: "Toestemming",
  legitimateInterest: "Gerechtvaardigd belang",
  acceptAll: "Alles accepteren",
  rejectAll: "Alles weigeren",
  save: "Keuzes opslaan",
  saved: "Keuzes opgeslagen",
  empty: "Geen leveranciers gevonden",
  details: "Details",
  close: "Details sluiten",
  consentPurposes: "Doeleinden (toestemming)",
  legIntPurposes: "Doeleinden (gerechtvaardigd belang)",
  specialPurposes: "Speciale doeleinden",
  features: "Functies",
  dataCategories: "Gegevenscategorieën",
  retention: "Bewaartermijn",
  retentionDays: "Dagen: {days}",
  standardRetention: "Standaardbewaartermijn",
  privacyPolicy: "Privacybeleid",
  legIntClaim: "Verklaring gerechtvaardigd belang",
  storage: "Opslag op het apparaat",
  cookieMaxAge: "Maximale cookieduur (dagen): {days}",
  cookieSession: "Cookies zonder vaste vervaldatum",
  cookieRefresh: "De vervaldatum van de cookie wordt bij gebruik verlengd",
  noCookies: "Gebruikt geen cookies",
  nonCookieAccess:
    "Gebruikt andere opslag- of toegangsmethoden op het apparaat",
  storageDisclosure: "Opslagverklaring",
} as const satisfies TcfMessages;
export default labels;
export { labels };
