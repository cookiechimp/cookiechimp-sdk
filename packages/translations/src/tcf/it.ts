import type { TcfMessages } from "./index";

const labels = {
  title: "Partner e finalità",
  purposes: "Finalità",
  specialFeatures: "Funzionalità speciali",
  vendors: "Fornitori",
  search: "Cerca fornitori",
  consent: "Consenso",
  legitimateInterest: "Legittimo interesse",
  acceptAll: "Accetta tutto",
  rejectAll: "Rifiuta tutto",
  save: "Salva le scelte",
  saved: "Scelte salvate",
  empty: "Nessun fornitore corrisponde",
  details: "Dettagli",
  close: "Chiudi dettagli",
  consentPurposes: "Finalità (consenso)",
  legIntPurposes: "Finalità (legittimo interesse)",
  specialPurposes: "Finalità speciali",
  features: "Funzionalità",
  dataCategories: "Categorie di dati",
  retention: "Conservazione dei dati",
  retentionDays: "{days} giorni",
  standardRetention: "Conservazione standard",
  privacyPolicy: "Informativa sulla privacy",
  legIntClaim: "Dichiarazione di legittimo interesse",
  storage: "Archiviazione sul dispositivo",
  cookieMaxAge: "Cookie conservati fino a {days} giorni",
  cookieSession: "Cookie senza scadenza fissa",
  cookieRefresh: "La scadenza del cookie si rinnova con l’uso",
  noCookies: "Non utilizza cookie",
  nonCookieAccess:
    "Utilizza altri metodi di archiviazione o accesso sul dispositivo",
  storageDisclosure: "Informativa sull’archiviazione",
} as const satisfies TcfMessages;
export default labels;
export { labels };
