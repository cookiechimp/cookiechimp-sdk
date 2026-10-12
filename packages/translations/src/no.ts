import type { Messages } from "./index";

const messages = {
  "banner.title": "Personvernvalg",
  "banner.description": "Velg hvilke informasjonskapsler som kan brukes.",
  "banner.acceptAll": "Godta alle informasjonskapsler",
  "banner.rejectAll": "Avvis valgfrie",
  "banner.customize": "Tilpass",
  "banner.save": "Lagre",
  "banner.close": "Lukk",
  "preferences.title": "Innstillinger for informasjonskapsler",
  "preferences.description": "Styr informasjonskapsler etter formål.",
  "category.necessary.name": "Nødvendige",
  "category.necessary.description": "Nødvendige for dette nettstedet.",
  "category.functional.name": "Funksjonelle",
  "category.functional.description": "Husker innstillinger.",
  "category.analytics.name": "Analyse",
  "category.analytics.description": "Måler bruken av nettstedet.",
  "category.marketing.name": "Markedsføring",
  "category.marketing.description": "Støtter annonsering.",
  "optOut.label": "Velg bort salg eller deling",
  "gpc.honoured": "Global personvernkontroll er respektert.",
  "recall.label": "Se gjennom valg for informasjonskapsler",
  "gated.placeholder": "Dette innholdet krever tillatelse.",
  "gated.allow": "Tillat innhold",
} as const satisfies Messages;
export default messages;
export { messages };
