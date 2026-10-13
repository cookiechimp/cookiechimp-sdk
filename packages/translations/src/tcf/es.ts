import type { TcfMessages } from "./index";

const labels = {
  title: "Socios y finalidades",
  purposes: "Finalidades",
  specialFeatures: "Características especiales",
  vendors: "Proveedores",
  search: "Buscar proveedores",
  consent: "Consentimiento",
  legitimateInterest: "Interés legítimo",
  acceptAll: "Aceptar todo",
  rejectAll: "Rechazar todo",
  save: "Guardar opciones",
  saved: "Opciones guardadas",
  empty: "Ningún proveedor coincide",
  details: "Detalles",
  close: "Cerrar detalles",
  consentPurposes: "Finalidades (consentimiento)",
  legIntPurposes: "Finalidades (interés legítimo)",
  specialPurposes: "Finalidades especiales",
  features: "Características",
  dataCategories: "Categorías de datos",
  retention: "Conservación de datos",
  retentionDays: "{days} días",
  standardRetention: "Conservación estándar",
  privacyPolicy: "Política de privacidad",
  legIntClaim: "Declaración de interés legítimo",
  storage: "Almacenamiento en el dispositivo",
  cookieMaxAge: "Cookies almacenadas hasta {days} días",
  cookieSession: "Cookies sin caducidad fija",
  cookieRefresh: "La caducidad de la cookie se renueva con el uso",
  noCookies: "No utiliza cookies",
  nonCookieAccess:
    "Utiliza otros métodos de almacenamiento o acceso en el dispositivo",
  storageDisclosure: "Declaración de almacenamiento",
} as const satisfies TcfMessages;
export default labels;
export { labels };
