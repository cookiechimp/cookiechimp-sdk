import type { Messages } from "./index";

const messages = {
  "banner.title": "Ihre Datenschutzauswahl",
  "banner.description":
    "Wählen Sie, welche Cookies diese Website verwenden darf.",
  "banner.acceptAll": "Alle Cookies akzeptieren",
  "banner.rejectAll": "Optionale Cookies ablehnen",
  "banner.customize": "Auswahl anpassen",
  "banner.save": "Auswahl speichern",
  "banner.close": "Schließen",
  "preferences.title": "Cookie-Einstellungen",
  "preferences.description": "Verwalten Sie Cookies nach Zweck.",
  "category.necessary.name": "Notwendig",
  "category.necessary.description": "Für den Betrieb der Website erforderlich.",
  "category.functional.name": "Funktional",
  "category.functional.description": "Speichert Einstellungen.",
  "category.analytics.name": "Analyse",
  "category.analytics.description":
    "Hilft uns, die Nutzung der Website zu verstehen.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Unterstützt Werbung.",
  "optOut.label": "Verkauf oder Weitergabe ablehnen",
  "gpc.honoured": "Global Privacy Control wurde berücksichtigt.",
  "recall.label": "Cookie-Auswahl prüfen",
  "gated.placeholder": "Dieser Inhalt benötigt Ihre Zustimmung.",
  "gated.allow": "Inhalt erlauben",
} as const satisfies Messages;
export default messages;
export { messages };
