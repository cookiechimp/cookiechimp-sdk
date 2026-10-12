import type { Messages } from "./index";

const messages = {
  "banner.title": "Adatvédelmi beállítások",
  "banner.description": "Válassza ki, mely sütik használhatók.",
  "banner.acceptAll": "Összes süti elfogadása",
  "banner.rejectAll": "Opcionálisak elutasítása",
  "banner.customize": "Testreszabás",
  "banner.save": "Mentés",
  "banner.close": "Bezárás",
  "preferences.title": "Sütibeállítások",
  "preferences.description": "Kezelje a sütiket cél szerint.",
  "category.necessary.name": "Szükséges",
  "category.necessary.description": "Az oldal működéséhez szükséges.",
  "category.functional.name": "Funkcionális",
  "category.functional.description": "Megjegyzik a beállításokat.",
  "category.analytics.name": "Analitikai",
  "category.analytics.description": "Mérik az oldal használatát.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Támogatják a hirdetéseket.",
  "optOut.label": "Értékesítés vagy megosztás elutasítása",
  "gpc.honoured": "A globális adatvédelmi jelzést tiszteletben tartottuk.",
  "recall.label": "Sütiválasztások áttekintése",
  "gated.placeholder": "Ehhez a tartalomhoz az engedélye szükséges.",
  "gated.allow": "Tartalom engedélyezése",
} as const satisfies Messages;
export default messages;
export { messages };
