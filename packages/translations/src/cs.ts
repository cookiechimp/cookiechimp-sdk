import type { Messages } from "./index";

const messages = {
  "banner.title": "Volby soukromí",
  "banner.description": "Zvolte, které soubory cookie lze používat.",
  "banner.acceptAll": "Přijmout všechny soubory cookie",
  "banner.rejectAll": "Odmítnout volitelné",
  "banner.customize": "Přizpůsobit",
  "banner.save": "Uložit",
  "banner.close": "Zavřít",
  "preferences.title": "Nastavení souborů cookie",
  "preferences.description": "Spravujte soubory cookie podle účelu.",
  "category.necessary.name": "Nezbytné",
  "category.necessary.description": "Potřebné pro tento web.",
  "category.functional.name": "Funkční",
  "category.functional.description": "Pamatují si nastavení.",
  "category.analytics.name": "Analytické",
  "category.analytics.description": "Měří používání webu.",
  "category.marketing.name": "Marketingové",
  "category.marketing.description": "Podporují reklamu.",
  "optOut.label": "Odmítnout prodej nebo sdílení",
  "gpc.honoured": "Globální kontrola soukromí byla respektována.",
  "recall.label": "Zkontrolovat volby souborů cookie",
  "gated.placeholder": "Tento obsah vyžaduje váš souhlas.",
  "gated.allow": "Povolit obsah",
} as const satisfies Messages;
export default messages;
export { messages };
