import type { Messages } from "./index";

const messages = {
  "banner.title": "Privaatsusvalikud",
  "banner.description": "Valige, milliseid küpsiseid võib kasutada.",
  "banner.acceptAll": "Nõustu kõigi küpsistega",
  "banner.rejectAll": "Keeldu valikulistest",
  "banner.customize": "Kohanda",
  "banner.save": "Salvesta",
  "banner.close": "Sulge",
  "preferences.title": "Küpsiste eelistused",
  "preferences.description": "Hallake küpsiseid eesmärgi järgi.",
  "category.necessary.name": "Vajalikud",
  "category.necessary.description": "Vajalikud selle saidi jaoks.",
  "category.functional.name": "Funktsionaalsed",
  "category.functional.description": "Jätavad seaded meelde.",
  "category.analytics.name": "Analüütilised",
  "category.analytics.description": "Mõõdavad saidi kasutamist.",
  "category.marketing.name": "Turundus",
  "category.marketing.description": "Toetavad reklaamimist.",
  "optOut.label": "Keeldu müügist või jagamisest",
  "gpc.honoured": "Üldist privaatsuskontrolli on järgitud.",
  "recall.label": "Vaata küpsisevalikud üle",
  "gated.placeholder": "See sisu vajab teie luba.",
  "gated.allow": "Luba sisu",
} as const satisfies Messages;
export default messages;
export { messages };
