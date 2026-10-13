import type { TcfMessages } from "./index";

const labels = {
  title: "Партнери та цілі",
  purposes: "Цілі",
  specialFeatures: "Спеціальні функції",
  vendors: "Постачальники",
  search: "Пошук постачальників",
  consent: "Згода",
  legitimateInterest: "Законний інтерес",
  acceptAll: "Прийняти все",
  rejectAll: "Відхилити все",
  save: "Зберегти вибір",
  saved: "Вибір збережено",
  empty: "Немає відповідних постачальників",
  details: "Докладніше",
  close: "Закрити подробиці",
  consentPurposes: "Цілі (згода)",
  legIntPurposes: "Цілі (законний інтерес)",
  specialPurposes: "Спеціальні цілі",
  features: "Функції",
  dataCategories: "Категорії даних",
  retention: "Зберігання даних",
  retentionDays: "{days} дн.",
  standardRetention: "Стандартний строк зберігання",
  privacyPolicy: "Політика конфіденційності",
  legIntClaim: "Заява про законний інтерес",
  storage: "Зберігання на пристрої",
  cookieMaxAge: "Файли cookie зберігаються до {days} дн.",
  cookieSession: "Файли cookie без фіксованого строку дії",
  cookieRefresh: "Строк дії файлу cookie оновлюється під час використання",
  noCookies: "Не використовує файли cookie",
  nonCookieAccess:
    "Використовує інші способи зберігання або доступу на пристрої",
  storageDisclosure: "Відомості про зберігання",
} as const satisfies TcfMessages;
export default labels;
export { labels };
