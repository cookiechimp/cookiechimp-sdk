import type { Messages } from "./index";

const messages = {
  "banner.title": "Privatumo pasirinkimai",
  "banner.description": "Pasirinkite, kuriuos slapukus galima naudoti.",
  "banner.acceptAll": "Priimti visus slapukus",
  "banner.rejectAll": "Atmesti pasirenkamus",
  "banner.customize": "Tinkinti",
  "banner.save": "Išsaugoti",
  "banner.close": "Uždaryti",
  "preferences.title": "Slapukų nuostatos",
  "preferences.description": "Valdykite slapukus pagal paskirtį.",
  "category.necessary.name": "Būtinieji",
  "category.necessary.description": "Reikalingi šiai svetainei.",
  "category.functional.name": "Funkciniai",
  "category.functional.description": "Įsimena nustatymus.",
  "category.analytics.name": "Analitiniai",
  "category.analytics.description": "Matuoja svetainės naudojimą.",
  "category.marketing.name": "Rinkodaros",
  "category.marketing.description": "Padeda rodyti reklamą.",
  "optOut.label": "Atsisakyti pardavimo ar bendrinimo",
  "gpc.honoured": "Visuotinio privatumo valdymo nuostata buvo gerbiama.",
  "recall.label": "Peržiūrėti slapukų pasirinkimus",
  "gated.placeholder": "Šiam turiniui reikia jūsų leidimo.",
  "gated.allow": "Leisti turinį",
} as const satisfies Messages;
export default messages;
export { messages };
