import type { Messages } from "./index";

const messages = {
  "banner.title": "Odabir privatnosti",
  "banner.description": "Odaberite koji se kolačići mogu upotrebljavati.",
  "banner.acceptAll": "Prihvati sve kolačiće",
  "banner.rejectAll": "Odbij neobavezne",
  "banner.customize": "Prilagodi",
  "banner.save": "Spremi",
  "banner.close": "Zatvori",
  "preferences.title": "Postavke kolačića",
  "preferences.description": "Upravljajte kolačićima prema svrsi.",
  "category.necessary.name": "Nužni",
  "category.necessary.description": "Potrebni za ovu stranicu.",
  "category.functional.name": "Funkcionalni",
  "category.functional.description": "Pamte postavke.",
  "category.analytics.name": "Analitički",
  "category.analytics.description": "Mjere upotrebu stranice.",
  "category.marketing.name": "Marketinški",
  "category.marketing.description": "Podržavaju oglašavanje.",
  "optOut.label": "Odbij prodaju ili dijeljenje",
  "gpc.honoured": "Globalna kontrola privatnosti je poštovana.",
  "recall.label": "Pregledaj odabir kolačića",
  "gated.placeholder": "Za ovaj sadržaj potrebno je vaše dopuštenje.",
  "gated.allow": "Dopusti sadržaj",
} as const satisfies Messages;
export default messages;
export { messages };
