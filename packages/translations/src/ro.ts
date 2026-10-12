import type { Messages } from "./index";

const messages = {
  "banner.title": "Opțiuni de confidențialitate",
  "banner.description": "Alegeți ce module cookie pot fi utilizate.",
  "banner.acceptAll": "Acceptă toate modulele cookie",
  "banner.rejectAll": "Respinge opționalele",
  "banner.customize": "Personalizează",
  "banner.save": "Salvează",
  "banner.close": "Închide",
  "preferences.title": "Preferințe cookie",
  "preferences.description": "Controlați modulele cookie după scop.",
  "category.necessary.name": "Necesare",
  "category.necessary.description": "Necesare pentru acest site.",
  "category.functional.name": "Funcționale",
  "category.functional.description": "Rețin setările.",
  "category.analytics.name": "Analitice",
  "category.analytics.description": "Măsoară utilizarea site-ului.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Sprijină publicitatea.",
  "optOut.label": "Refuză vânzarea sau partajarea",
  "gpc.honoured": "Controlul global al confidențialității a fost respectat.",
  "recall.label": "Revizuiește opțiunile cookie",
  "gated.placeholder": "Acest conținut necesită permisiunea dvs.",
  "gated.allow": "Permite conținutul",
} as const satisfies Messages;
export default messages;
export { messages };
