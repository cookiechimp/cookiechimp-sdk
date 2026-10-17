import type { Messages } from "./index";

const messages = {
  "banner.title": "Privātuma izvēles",
  "banner.description": "Izvēlieties, kuras sīkdatnes drīkst izmantot.",
  "banner.acceptAll": "Pieņemt visas sīkdatnes",
  "banner.rejectAll": "Noraidīt neobligātās sīkdatnes",
  "banner.customize": "Pielāgot",
  "banner.save": "Saglabāt",
  "banner.close": "Aizvērt",
  "preferences.title": "Sīkdatņu iestatījumi",
  "preferences.description": "Pārvaldiet sīkdatnes pēc nolūka.",
  "category.necessary.name": "Nepieciešamās",
  "category.necessary.description": "Nepieciešamas šai vietnei.",
  "category.functional.name": "Funkcionālās",
  "category.functional.description": "Atceras iestatījumus.",
  "category.analytics.name": "Analītiskās",
  "category.analytics.description": "Mēra vietnes lietojumu.",
  "category.marketing.name": "Mārketinga",
  "category.marketing.description": "Atbalsta reklamēšanu.",
  "optOut.label": "Atteikties no pārdošanas vai kopīgošanas",
  "gpc.honoured": "Globālā privātuma kontrole ir ievērota.",
  "recall.label": "Pārskatīt sīkdatņu izvēles",
  "gated.placeholder": "Šim saturam nepieciešama jūsu atļauja.",
  "gated.allow": "Atļaut saturu",
} as const satisfies Messages;
export default messages;
export { messages };
