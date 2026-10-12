import type { Messages } from "./index";

const messages = {
  "banner.title": "Настройки за поверителност",
  "banner.description": "Изберете кои бисквитки могат да се използват.",
  "banner.acceptAll": "Приемане на всички бисквитки",
  "banner.rejectAll": "Отхвърляне на незадължителните",
  "banner.customize": "Персонализиране",
  "banner.save": "Запазване",
  "banner.close": "Затваряне",
  "preferences.title": "Настройки за бисквитки",
  "preferences.description": "Управлявайте бисквитките според целта.",
  "category.necessary.name": "Необходими",
  "category.necessary.description": "Нужни за този сайт.",
  "category.functional.name": "Функционални",
  "category.functional.description": "Запомнят настройките.",
  "category.analytics.name": "Аналитични",
  "category.analytics.description": "Измерват използването на сайта.",
  "category.marketing.name": "Маркетингови",
  "category.marketing.description": "Подпомагат рекламата.",
  "optOut.label": "Отказ от продажба или споделяне",
  "gpc.honoured": "Глобалният контрол на поверителността е спазен.",
  "recall.label": "Преглед на избора за бисквитки",
  "gated.placeholder": "Това съдържание изисква вашето разрешение.",
  "gated.allow": "Разрешаване на съдържанието",
} as const satisfies Messages;
export default messages;
export { messages };
