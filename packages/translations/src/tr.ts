import type { Messages } from "./index";

const messages = {
  "banner.title": "Gizlilik seçenekleri",
  "banner.description": "Hangi çerezlerin kullanılabileceğini seçin.",
  "banner.acceptAll": "Tüm çerezleri kabul et",
  "banner.rejectAll": "İsteğe bağlı olanları reddet",
  "banner.customize": "Özelleştir",
  "banner.save": "Kaydet",
  "banner.close": "Kapat",
  "preferences.title": "Çerez tercihleri",
  "preferences.description": "Çerezleri amaca göre yönetin.",
  "category.necessary.name": "Gerekli",
  "category.necessary.description": "Bu site için gereklidir.",
  "category.functional.name": "İşlevsel",
  "category.functional.description": "Ayarları hatırlar.",
  "category.analytics.name": "Analiz",
  "category.analytics.description": "Site kullanımını ölçer.",
  "category.marketing.name": "Pazarlama",
  "category.marketing.description": "Reklamları destekler.",
  "optOut.label": "Satış veya paylaşımdan vazgeç",
  "gpc.honoured": "Küresel Gizlilik Denetimi tercihine uyuldu.",
  "recall.label": "Çerez seçimlerini gözden geçir",
  "gated.placeholder": "Bu içerik için izniniz gerekiyor.",
  "gated.allow": "İçeriğe izin ver",
} as const satisfies Messages;
export default messages;
export { messages };
