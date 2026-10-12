import type { Messages } from "./index";

const messages = {
  "banner.title": "Privacykeuzes",
  "banner.description": "Kies welke cookies mogen worden gebruikt.",
  "banner.acceptAll": "Alle cookies accepteren",
  "banner.rejectAll": "Optionele cookies weigeren",
  "banner.customize": "Aanpassen",
  "banner.save": "Opslaan",
  "banner.close": "Sluiten",
  "preferences.title": "Cookievoorkeuren",
  "preferences.description": "Beheer cookies per doel.",
  "category.necessary.name": "Noodzakelijk",
  "category.necessary.description": "Nodig voor deze site.",
  "category.functional.name": "Functioneel",
  "category.functional.description": "Onthoudt instellingen.",
  "category.analytics.name": "Analytisch",
  "category.analytics.description": "Meet het gebruik van de site.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Ondersteunt advertenties.",
  "optOut.label": "Verkoop of delen weigeren",
  "gpc.honoured": "Global Privacy Control is gerespecteerd.",
  "recall.label": "Cookiekeuzes bekijken",
  "gated.placeholder": "Voor deze inhoud is je toestemming nodig.",
  "gated.allow": "Inhoud toestaan",
} as const satisfies Messages;
export default messages;
export { messages };
