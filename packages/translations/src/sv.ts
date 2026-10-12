import type { Messages } from "./index";

const messages = {
  "banner.title": "Integritetsval",
  "banner.description": "Välj vilka kakor som får användas.",
  "banner.acceptAll": "Godkänn alla kakor",
  "banner.rejectAll": "Avvisa valfria",
  "banner.customize": "Anpassa",
  "banner.save": "Spara",
  "banner.close": "Stäng",
  "preferences.title": "Inställningar för kakor",
  "preferences.description": "Styr kakor efter syfte.",
  "category.necessary.name": "Nödvändiga",
  "category.necessary.description": "Behövs för den här webbplatsen.",
  "category.functional.name": "Funktionella",
  "category.functional.description": "Kommer ihåg inställningar.",
  "category.analytics.name": "Analys",
  "category.analytics.description": "Mäter användningen av webbplatsen.",
  "category.marketing.name": "Marknadsföring",
  "category.marketing.description": "Stöder annonsering.",
  "optOut.label": "Avstå från försäljning eller delning",
  "gpc.honoured": "Global integritetskontroll har respekterats.",
  "recall.label": "Granska val för kakor",
  "gated.placeholder": "Det här innehållet kräver ditt tillstånd.",
  "gated.allow": "Tillåt innehåll",
} as const satisfies Messages;
export default messages;
export { messages };
