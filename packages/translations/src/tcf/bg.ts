import type { TcfMessages } from "./index";

const labels = {
  title: "Партньори и цели",
  purposes: "Цели",
  specialFeatures: "Специални функции",
  vendors: "Доставчици",
  search: "Търсене на доставчици",
  consent: "Съгласие",
  legitimateInterest: "Законен интерес",
  acceptAll: "Приемане на всички",
  rejectAll: "Отхвърляне на всички",
  save: "Запазване на избора",
  saved: "Изборът е запазен",
  empty: "Няма съвпадащи доставчици",
  details: "Подробности",
  close: "Затваряне на подробностите",
  consentPurposes: "Цели (съгласие)",
  legIntPurposes: "Цели (законен интерес)",
  specialPurposes: "Специални цели",
  features: "Функции",
  dataCategories: "Категории данни",
  retention: "Съхранение на данни",
  retentionDays: "{days} дни",
  standardRetention: "Стандартен срок на съхранение",
  privacyPolicy: "Политика за поверителност",
  legIntClaim: "Декларация за законен интерес",
  storage: "Съхранение на устройството",
  cookieMaxAge: "Бисквитките се съхраняват до {days} дни",
  cookieSession: "Бисквитки без фиксиран срок",
  cookieRefresh: "Срокът на бисквитката се подновява при използване",
  noCookies: "Не използва бисквитки",
  nonCookieAccess:
    "Използва други методи за съхранение или достъп до устройството",
  storageDisclosure: "Информация за съхранението",
} as const satisfies TcfMessages;
export default labels;
export { labels };
