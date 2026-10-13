import type { TcfMessages } from "./index";

const labels = {
  title: "Comhpháirtithe agus cuspóirí",
  purposes: "Cuspóirí",
  specialFeatures: "Gnéithe speisialta",
  vendors: "Díoltóirí",
  search: "Cuardaigh díoltóirí",
  consent: "Toiliú",
  legitimateInterest: "Leas dlisteanach",
  acceptAll: "Glac le gach rud",
  rejectAll: "Diúltaigh do gach rud",
  save: "Sábháil roghanna",
  saved: "Roghanna sábháilte",
  empty: "Níl aon díoltóir ag teacht leis",
  details: "Sonraí breise",
  close: "Dún na sonraí breise",
  consentPurposes: "Cuspóirí (toiliú)",
  legIntPurposes: "Cuspóirí (leas dlisteanach)",
  specialPurposes: "Cuspóirí speisialta",
  features: "Gnéithe",
  dataCategories: "Catagóirí sonraí",
  retention: "Coinneáil sonraí",
  retentionDays: "{days} lá",
  standardRetention: "Gnáth-thréimhse choinneála",
  privacyPolicy: "Beartas príobháideachais",
  legIntClaim: "Ráiteas leasa dhlisteanaigh",
  storage: "Stóráil ar an ngléas",
  cookieMaxAge: "Fianáin stóráilte ar feadh suas le {days} lá",
  cookieSession: "Fianáin gan dáta éaga seasta",
  cookieRefresh: "Athnuaitear dáta éaga an fhianáin le húsáid",
  noCookies: "Ní úsáideann sé fianáin",
  nonCookieAccess:
    "Úsáideann sé modhanna eile stórála nó rochtana ar an ngléas",
  storageDisclosure: "Nochtadh stórála",
} as const satisfies TcfMessages;
export default labels;
export { labels };
