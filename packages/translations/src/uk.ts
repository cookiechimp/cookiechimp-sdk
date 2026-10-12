import type { Messages } from "./index";

const messages = {
  "banner.title": "Налаштування приватності",
  "banner.description": "Виберіть, які файли cookie можна використовувати.",
  "banner.acceptAll": "Прийняти всі файли cookie",
  "banner.rejectAll": "Відхилити необов’язкові",
  "banner.customize": "Налаштувати",
  "banner.save": "Зберегти",
  "banner.close": "Закрити",
  "preferences.title": "Налаштування файлів cookie",
  "preferences.description": "Керуйте файлами cookie за призначенням.",
  "category.necessary.name": "Необхідні",
  "category.necessary.description": "Потрібні для цього сайту.",
  "category.functional.name": "Функціональні",
  "category.functional.description": "Запам’ятовують налаштування.",
  "category.analytics.name": "Аналітичні",
  "category.analytics.description": "Вимірюють використання сайту.",
  "category.marketing.name": "Маркетингові",
  "category.marketing.description": "Підтримують рекламу.",
  "optOut.label": "Відмовитися від продажу чи поширення",
  "gpc.honoured": "Глобальний контроль приватності було враховано.",
  "recall.label": "Переглянути вибір файлів cookie",
  "gated.placeholder": "Цей вміст потребує вашого дозволу.",
  "gated.allow": "Дозволити вміст",
} as const satisfies Messages;
export default messages;
export { messages };
