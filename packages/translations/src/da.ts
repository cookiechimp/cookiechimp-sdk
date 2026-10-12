import type { Messages } from "./index";

const messages = {
  "banner.title": "Valg om privatliv",
  "banner.description": "Vælg, hvilke cookies der må bruges.",
  "banner.acceptAll": "Acceptér alle cookies",
  "banner.rejectAll": "Afvis valgfrie",
  "banner.customize": "Tilpas",
  "banner.save": "Gem",
  "banner.close": "Luk",
  "preferences.title": "Cookieindstillinger",
  "preferences.description": "Styr cookies efter formål.",
  "category.necessary.name": "Nødvendige",
  "category.necessary.description": "Nødvendige for dette websted.",
  "category.functional.name": "Funktionelle",
  "category.functional.description": "Husker indstillinger.",
  "category.analytics.name": "Analyse",
  "category.analytics.description": "Måler brugen af webstedet.",
  "category.marketing.name": "Markedsføring",
  "category.marketing.description": "Understøtter annoncering.",
  "optOut.label": "Fravælg salg eller deling",
  "gpc.honoured": "Global Privacy Control er blevet respekteret.",
  "recall.label": "Gennemgå cookievalg",
  "gated.placeholder": "Dette indhold kræver din tilladelse.",
  "gated.allow": "Tillad indhold",
} as const satisfies Messages;
export default messages;
export { messages };
