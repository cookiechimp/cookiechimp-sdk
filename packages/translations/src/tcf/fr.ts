import type { TcfMessages } from "./index";

const labels = {
  title: "Partenaires et finalités",
  purposes: "Finalités",
  specialFeatures: "Fonctionnalités spéciales",
  vendors: "Fournisseurs",
  search: "Rechercher des fournisseurs",
  consent: "Consentement",
  legitimateInterest: "Intérêt légitime",
  acceptAll: "Tout accepter",
  rejectAll: "Tout refuser",
  save: "Enregistrer les choix",
  saved: "Choix enregistrés",
  empty: "Aucun fournisseur ne correspond",
  details: "Détails",
  close: "Fermer les détails",
  consentPurposes: "Finalités (consentement)",
  legIntPurposes: "Finalités (intérêt légitime)",
  specialPurposes: "Finalités spéciales",
  features: "Fonctionnalités",
  dataCategories: "Catégories de données",
  retention: "Conservation des données",
  retentionDays: "Jours : {days}",
  standardRetention: "Durée de conservation standard",
  privacyPolicy: "Politique de confidentialité",
  legIntClaim: "Déclaration d’intérêt légitime",
  storage: "Stockage sur l’appareil",
  cookieMaxAge: "Durée maximale des cookies (jours) : {days}",
  cookieSession: "Cookies sans date d’expiration fixe",
  cookieRefresh: "La durée du cookie est renouvelée à chaque utilisation",
  noCookies: "N’utilise pas de cookies",
  nonCookieAccess:
    "Utilise d’autres méthodes de stockage ou d’accès sur l’appareil",
  storageDisclosure: "Déclaration de stockage",
} as const satisfies TcfMessages;
export default labels;
export { labels };
