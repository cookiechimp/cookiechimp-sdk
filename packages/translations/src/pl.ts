import type { Messages } from "./index";

const messages = {
  "banner.title": "Ustawienia prywatności",
  "banner.description": "Wybierz, które pliki cookie mogą być używane.",
  "banner.acceptAll": "Zaakceptuj wszystkie pliki cookie",
  "banner.rejectAll": "Odrzuć opcjonalne",
  "banner.customize": "Dostosuj",
  "banner.save": "Zapisz",
  "banner.close": "Zamknij",
  "preferences.title": "Ustawienia plików cookie",
  "preferences.description": "Zarządzaj plikami cookie według celu.",
  "category.necessary.name": "Niezbędne",
  "category.necessary.description": "Wymagane do działania tej witryny.",
  "category.functional.name": "Funkcjonalne",
  "category.functional.description": "Zapamiętują ustawienia.",
  "category.analytics.name": "Analityczne",
  "category.analytics.description": "Mierzą korzystanie z witryny.",
  "category.marketing.name": "Marketingowe",
  "category.marketing.description": "Wspierają reklamę.",
  "optOut.label": "Zrezygnuj ze sprzedaży lub udostępniania",
  "gpc.honoured": "Uszanowano Globalną Kontrolę Prywatności.",
  "recall.label": "Sprawdź wybory dotyczące plików cookie",
  "gated.placeholder": "Ta treść wymaga Twojej zgody.",
  "gated.allow": "Zezwól na treść",
} as const satisfies Messages;
export default messages;
export { messages };
