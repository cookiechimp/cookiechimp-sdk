import type { Messages } from "./index";

const messages = {
  "banner.title": "Izbire zasebnosti",
  "banner.description": "Izberite, kateri piškotki se lahko uporabljajo.",
  "banner.acceptAll": "Sprejmi vse piškotke",
  "banner.rejectAll": "Zavrni izbirne",
  "banner.customize": "Prilagodi",
  "banner.save": "Shrani",
  "banner.close": "Zapri",
  "preferences.title": "Nastavitve piškotkov",
  "preferences.description": "Upravljajte piškotke glede na namen.",
  "category.necessary.name": "Nujni",
  "category.necessary.description": "Potrebni za to spletno mesto.",
  "category.functional.name": "Funkcionalni",
  "category.functional.description": "Zapomnijo si nastavitve.",
  "category.analytics.name": "Analitični",
  "category.analytics.description": "Merijo uporabo spletnega mesta.",
  "category.marketing.name": "Trženjski",
  "category.marketing.description": "Podpirajo oglaševanje.",
  "optOut.label": "Zavrni prodajo ali deljenje",
  "gpc.honoured": "Globalna nastavitev zasebnosti je bila upoštevana.",
  "recall.label": "Preglej izbire piškotkov",
  "gated.placeholder": "Ta vsebina potrebuje vaše dovoljenje.",
  "gated.allow": "Dovoli vsebino",
} as const satisfies Messages;
export default messages;
export { messages };
