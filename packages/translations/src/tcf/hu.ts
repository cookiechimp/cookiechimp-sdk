import type { TcfMessages } from "./index";

const labels = {
  title: "Partnerek és célok",
  purposes: "Célok",
  specialFeatures: "Különleges funkciók",
  vendors: "Szolgáltatók",
  search: "Szolgáltatók keresése",
  consent: "Hozzájárulás",
  legitimateInterest: "Jogos érdek",
  acceptAll: "Összes elfogadása",
  rejectAll: "Összes elutasítása",
  save: "Választások mentése",
  saved: "Választások mentve",
  empty: "Nincs egyező szolgáltató",
  details: "Részletek",
  close: "Részletek bezárása",
  consentPurposes: "Célok (hozzájárulás)",
  legIntPurposes: "Célok (jogos érdek)",
  specialPurposes: "Különleges célok",
  features: "Funkciók",
  dataCategories: "Adatkategóriák",
  retention: "Adatmegőrzés",
  retentionDays: "{days} nap",
  standardRetention: "Általános megőrzési idő",
  privacyPolicy: "Adatvédelmi irányelvek",
  legIntClaim: "Jogos érdekre vonatkozó nyilatkozat",
  storage: "Tárolás az eszközön",
  cookieMaxAge: "A sütik legfeljebb {days} napig tárolódnak",
  cookieSession: "Rögzített lejárat nélküli sütik",
  cookieRefresh: "A süti lejárata használatkor megújul",
  noCookies: "Nem használ sütiket",
  nonCookieAccess:
    "Más tárolási vagy hozzáférési módokat is használ az eszközön",
  storageDisclosure: "Tárolási tájékoztató",
} as const satisfies TcfMessages;
export default labels;
export { labels };
