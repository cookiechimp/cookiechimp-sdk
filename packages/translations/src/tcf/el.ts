import type { TcfMessages } from "./index";

const labels = {
  title: "Συνεργάτες και σκοποί",
  purposes: "Σκοποί",
  specialFeatures: "Ειδικά χαρακτηριστικά",
  vendors: "Πάροχοι",
  search: "Αναζήτηση παρόχων",
  consent: "Συγκατάθεση",
  legitimateInterest: "Έννομο συμφέρον",
  acceptAll: "Αποδοχή όλων",
  rejectAll: "Απόρριψη όλων",
  save: "Αποθήκευση επιλογών",
  saved: "Οι επιλογές αποθηκεύτηκαν",
  empty: "Δεν βρέθηκαν πάροχοι",
  details: "Λεπτομέρειες",
  close: "Κλείσιμο λεπτομερειών",
  consentPurposes: "Σκοποί (συγκατάθεση)",
  legIntPurposes: "Σκοποί (έννομο συμφέρον)",
  specialPurposes: "Ειδικοί σκοποί",
  features: "Χαρακτηριστικά",
  dataCategories: "Κατηγορίες δεδομένων",
  retention: "Διατήρηση δεδομένων",
  retentionDays: "Ημέρες: {days}",
  standardRetention: "Τυπική διάρκεια διατήρησης",
  privacyPolicy: "Πολιτική απορρήτου",
  legIntClaim: "Δήλωση έννομου συμφέροντος",
  storage: "Αποθήκευση στη συσκευή",
  cookieMaxAge: "Μέγιστη διάρκεια cookies (ημέρες): {days}",
  cookieSession: "Cookies χωρίς σταθερή λήξη",
  cookieRefresh: "Η λήξη του cookie ανανεώνεται με τη χρήση",
  noCookies: "Δεν χρησιμοποιεί cookies",
  nonCookieAccess:
    "Χρησιμοποιεί άλλες μεθόδους αποθήκευσης ή πρόσβασης στη συσκευή",
  storageDisclosure: "Γνωστοποίηση αποθήκευσης",
} as const satisfies TcfMessages;
export default labels;
export { labels };
