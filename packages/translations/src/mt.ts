import type { Messages } from "./index";

const messages = {
  "banner.title": "Għażliet tal-privatezza",
  "banner.description": "Agħżel liema cookies jistgħu jintużaw.",
  "banner.acceptAll": "Aċċetta l-cookies kollha",
  "banner.rejectAll": "Irrifjuta dawk fakultattivi",
  "banner.customize": "Ippersonalizza",
  "banner.save": "Issejvja",
  "banner.close": "Agħlaq",
  "preferences.title": "Preferenzi tal-cookies",
  "preferences.description": "Ikkontrolla l-cookies skont l-iskop.",
  "category.necessary.name": "Meħtieġa",
  "category.necessary.description": "Meħtieġa għal dan is-sit.",
  "category.functional.name": "Funzjonali",
  "category.functional.description": "Jiftakru s-settings.",
  "category.analytics.name": "Analitiċi",
  "category.analytics.description": "Jkejlu l-użu tas-sit.",
  "category.marketing.name": "Kummerċjalizzazzjoni",
  "category.marketing.description": "Jappoġġjaw ir-reklamar.",
  "optOut.label": "Irrifjuta l-bejgħ jew il-kondiviżjoni",
  "gpc.honoured": "Il-Kontroll Globali tal-Privatezza ġie rispettat.",
  "recall.label": "Irrevedi l-għażliet tal-cookies",
  "gated.placeholder": "Dan il-kontenut jeħtieġ il-permess tiegħek.",
  "gated.allow": "Ippermetti l-kontenut",
} as const satisfies Messages;
export default messages;
export { messages };
