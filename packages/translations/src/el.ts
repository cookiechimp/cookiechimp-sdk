import type { Messages } from "./index";

const messages = {
  "banner.title": "Επιλογές απορρήτου",
  "banner.description": "Επιλέξτε ποια cookies μπορούν να χρησιμοποιηθούν.",
  "banner.acceptAll": "Αποδοχή όλων των cookies",
  "banner.rejectAll": "Απόρριψη προαιρετικών",
  "banner.customize": "Προσαρμογή",
  "banner.save": "Αποθήκευση",
  "banner.close": "Κλείσιμο",
  "preferences.title": "Προτιμήσεις cookies",
  "preferences.description": "Ελέγξτε τα cookies ανά σκοπό.",
  "category.necessary.name": "Απαραίτητα",
  "category.necessary.description": "Απαραίτητα για αυτόν τον ιστότοπο.",
  "category.functional.name": "Λειτουργικά",
  "category.functional.description": "Θυμούνται τις ρυθμίσεις.",
  "category.analytics.name": "Ανάλυσης",
  "category.analytics.description": "Μετρούν τη χρήση του ιστοτόπου.",
  "category.marketing.name": "Μάρκετινγκ",
  "category.marketing.description": "Υποστηρίζουν τη διαφήμιση.",
  "optOut.label": "Εξαίρεση από πώληση ή κοινοποίηση",
  "gpc.honoured": "Ο Καθολικός Έλεγχος Απορρήτου έχει τηρηθεί.",
  "recall.label": "Έλεγχος επιλογών cookies",
  "gated.placeholder": "Αυτό το περιεχόμενο χρειάζεται την άδειά σας.",
  "gated.allow": "Να επιτρέπεται το περιεχόμενο",
} as const satisfies Messages;
export default messages;
export { messages };
