import type { Messages } from "./index";

const messages = {
  "banner.title": "אפשרויות פרטיות",
  "banner.description": "בחרו באילו קובצי Cookie ניתן להשתמש.",
  "banner.acceptAll": "קבלת כל קובצי ה-Cookie",
  "banner.rejectAll": "דחיית קובצי Cookie שאינם הכרחיים",
  "banner.customize": "התאמה אישית",
  "banner.save": "שמירה",
  "banner.close": "סגירה",
  "preferences.title": "העדפות קובצי Cookie",
  "preferences.description": "ניהול קובצי Cookie לפי מטרה.",
  "category.necessary.name": "הכרחיים",
  "category.necessary.description": "נדרשים לאתר זה.",
  "category.functional.name": "פונקציונליים",
  "category.functional.description": "זוכרים הגדרות.",
  "category.analytics.name": "ניתוח",
  "category.analytics.description": "מודדים את השימוש באתר.",
  "category.marketing.name": "שיווק",
  "category.marketing.description": "תומכים בפרסום.",
  "optOut.label": "ביטול הסכמה למכירה או לשיתוף",
  "gpc.honoured": "בקשת בקרת הפרטיות הגלובלית כובדה.",
  "recall.label": "בדיקת אפשרויות קובצי Cookie",
  "gated.placeholder": "תוכן זה דורש את רשותכם.",
  "gated.allow": "אישור תוכן",
} as const satisfies Messages;
export default messages;
export { messages };
