import type { TcfMessages } from "./index";

const labels = {
  title: "Partnerzy i cele",
  purposes: "Cele",
  specialFeatures: "Funkcje specjalne",
  vendors: "Dostawcy",
  search: "Szukaj dostawców",
  consent: "Zgoda",
  legitimateInterest: "Prawnie uzasadniony interes",
  acceptAll: "Zaakceptuj wszystko",
  rejectAll: "Odrzuć wszystko",
  save: "Zapisz wybór",
  saved: "Wybór zapisany",
  empty: "Brak pasujących dostawców",
  details: "Szczegóły",
  close: "Zamknij szczegóły",
  consentPurposes: "Cele (zgoda)",
  legIntPurposes: "Cele (prawnie uzasadniony interes)",
  specialPurposes: "Cele specjalne",
  features: "Funkcje",
  dataCategories: "Kategorie danych",
  retention: "Okres przechowywania danych",
  retentionDays: "{days} dni",
  standardRetention: "Standardowy okres przechowywania",
  privacyPolicy: "Polityka prywatności",
  legIntClaim: "Oświadczenie o prawnie uzasadnionym interesie",
  storage: "Przechowywanie na urządzeniu",
  cookieMaxAge: "Pliki cookie przechowywane do {days} dni",
  cookieSession: "Pliki cookie bez stałego terminu wygaśnięcia",
  cookieRefresh: "Termin ważności pliku cookie jest odnawiany przy użyciu",
  noCookies: "Nie używa plików cookie",
  nonCookieAccess:
    "Używa innych metod przechowywania lub dostępu na urządzeniu",
  storageDisclosure: "Informacje o przechowywaniu",
} as const satisfies TcfMessages;
export default labels;
export { labels };
