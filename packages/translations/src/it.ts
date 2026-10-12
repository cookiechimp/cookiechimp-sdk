import type { Messages } from "./index";

const messages = {
  "banner.title": "Scelte sulla privacy",
  "banner.description": "Scegli quali cookie possono essere utilizzati.",
  "banner.acceptAll": "Accetta tutti i cookie",
  "banner.rejectAll": "Rifiuta quelli facoltativi",
  "banner.customize": "Personalizza",
  "banner.save": "Salva",
  "banner.close": "Chiudi",
  "preferences.title": "Preferenze sui cookie",
  "preferences.description": "Gestisci i cookie in base allo scopo.",
  "category.necessary.name": "Necessari",
  "category.necessary.description": "Necessari per questo sito.",
  "category.functional.name": "Funzionali",
  "category.functional.description": "Memorizzano le impostazioni.",
  "category.analytics.name": "Analitici",
  "category.analytics.description": "Misurano l’utilizzo del sito.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Supportano la pubblicità.",
  "optOut.label": "Rifiuta vendita o condivisione",
  "gpc.honoured": "Il Controllo globale della privacy è stato rispettato.",
  "recall.label": "Rivedi le scelte sui cookie",
  "gated.placeholder": "Questo contenuto richiede il tuo consenso.",
  "gated.allow": "Consenti contenuto",
} as const satisfies Messages;
export default messages;
export { messages };
