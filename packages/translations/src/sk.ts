import type { Messages } from "./index";

const messages = {
  "banner.title": "Voľby súkromia",
  "banner.description": "Vyberte, ktoré súbory cookie sa môžu používať.",
  "banner.acceptAll": "Prijať všetky súbory cookie",
  "banner.rejectAll": "Odmietnuť voliteľné",
  "banner.customize": "Prispôsobiť",
  "banner.save": "Uložiť",
  "banner.close": "Zavrieť",
  "preferences.title": "Nastavenia súborov cookie",
  "preferences.description": "Spravujte súbory cookie podľa účelu.",
  "category.necessary.name": "Nevyhnutné",
  "category.necessary.description": "Potrebné pre túto stránku.",
  "category.functional.name": "Funkčné",
  "category.functional.description": "Pamätajú si nastavenia.",
  "category.analytics.name": "Analytické",
  "category.analytics.description": "Merajú používanie stránky.",
  "category.marketing.name": "Marketingové",
  "category.marketing.description": "Podporujú reklamu.",
  "optOut.label": "Odmietnuť predaj alebo zdieľanie",
  "gpc.honoured": "Globálna kontrola súkromia bola rešpektovaná.",
  "recall.label": "Skontrolovať voľby súborov cookie",
  "gated.placeholder": "Tento obsah vyžaduje váš súhlas.",
  "gated.allow": "Povoliť obsah",
} as const satisfies Messages;
export default messages;
export { messages };
