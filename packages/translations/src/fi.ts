import type { Messages } from "./index";

const messages = {
  "banner.title": "Tietosuojavalinnat",
  "banner.description": "Valitse, mitä evästeitä voidaan käyttää.",
  "banner.acceptAll": "Hyväksy kaikki evästeet",
  "banner.rejectAll": "Hylkää valinnaiset",
  "banner.customize": "Mukauta",
  "banner.save": "Tallenna",
  "banner.close": "Sulje",
  "preferences.title": "Evästeasetukset",
  "preferences.description": "Hallitse evästeitä käyttötarkoituksen mukaan.",
  "category.necessary.name": "Välttämättömät",
  "category.necessary.description": "Tarvitaan tällä sivustolla.",
  "category.functional.name": "Toiminnalliset",
  "category.functional.description": "Muistavat asetukset.",
  "category.analytics.name": "Analytiikka",
  "category.analytics.description": "Mittaavat sivuston käyttöä.",
  "category.marketing.name": "Markkinointi",
  "category.marketing.description": "Tukevat mainontaa.",
  "optOut.label": "Estä myynti tai jakaminen",
  "gpc.honoured": "Yleistä tietosuojavalintaa on noudatettu.",
  "recall.label": "Tarkista evästevalinnat",
  "gated.placeholder": "Tämä sisältö tarvitsee lupasi.",
  "gated.allow": "Salli sisältö",
} as const satisfies Messages;
export default messages;
export { messages };
