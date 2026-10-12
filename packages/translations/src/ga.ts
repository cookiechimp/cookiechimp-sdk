import type { Messages } from "./index";

const messages = {
  "banner.title": "Roghanna príobháideachais",
  "banner.description": "Roghnaigh na fianáin is féidir a úsáid.",
  "banner.acceptAll": "Glac le gach fianán",
  "banner.rejectAll": "Diúltaigh do na cinn roghnacha",
  "banner.customize": "Saincheap",
  "banner.save": "Sábháil",
  "banner.close": "Dún",
  "preferences.title": "Sainroghanna fianán",
  "preferences.description": "Rialaigh fianáin de réir cuspóra.",
  "category.necessary.name": "Riachtanach",
  "category.necessary.description": "Riachtanach don suíomh seo.",
  "category.functional.name": "Feidhmiúil",
  "category.functional.description": "Cuimhníonn siad ar shocruithe.",
  "category.analytics.name": "Anailísíocht",
  "category.analytics.description": "Tomhaiseann siad úsáid an tsuímh.",
  "category.marketing.name": "Margaíocht",
  "category.marketing.description": "Tacaíonn siad le fógraíocht.",
  "optOut.label": "Diúltaigh do dhíol nó do chomhroinnt",
  "gpc.honoured": "Cloíodh leis an Rialú Príobháideachais Domhanda.",
  "recall.label": "Athbhreithnigh roghanna fianán",
  "gated.placeholder": "Teastaíonn do chead ón ábhar seo.",
  "gated.allow": "Ceadaigh ábhar",
} as const satisfies Messages;
export default messages;
export { messages };
