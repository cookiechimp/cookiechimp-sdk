import type { Messages } from "./index";

const messages = {
  "banner.title": "خيارات الخصوصية",
  "banner.description": "اختر ملفات تعريف الارتباط التي يمكن استخدامها.",
  "banner.acceptAll": "قبول جميع ملفات تعريف الارتباط",
  "banner.rejectAll": "رفض الاختيارية",
  "banner.customize": "تخصيص",
  "banner.save": "حفظ",
  "banner.close": "إغلاق",
  "preferences.title": "تفضيلات ملفات تعريف الارتباط",
  "preferences.description": "تحكم في ملفات تعريف الارتباط حسب الغرض.",
  "category.necessary.name": "ضرورية",
  "category.necessary.description": "مطلوبة لهذا الموقع.",
  "category.functional.name": "وظيفية",
  "category.functional.description": "تتذكر الإعدادات.",
  "category.analytics.name": "تحليلية",
  "category.analytics.description": "تقيس استخدام الموقع.",
  "category.marketing.name": "تسويقية",
  "category.marketing.description": "تدعم الإعلانات.",
  "optOut.label": "رفض البيع أو المشاركة",
  "gpc.honoured": "تم احترام التحكم العالمي في الخصوصية.",
  "recall.label": "مراجعة خيارات ملفات تعريف الارتباط",
  "gated.placeholder": "يحتاج هذا المحتوى إلى إذنك.",
  "gated.allow": "السماح بالمحتوى",
} as const satisfies Messages;
export default messages;
export { messages };
