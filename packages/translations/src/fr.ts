import type { Messages } from "./index";

const messages = {
  "banner.title": "Vos choix de confidentialité",
  "banner.description": "Choisissez les cookies que ce site peut utiliser.",
  "banner.acceptAll": "Tout accepter",
  "banner.rejectAll": "Refuser les cookies facultatifs",
  "banner.customize": "Personnaliser",
  "banner.save": "Enregistrer",
  "banner.close": "Fermer",
  "preferences.title": "Préférences de cookies",
  "preferences.description": "Gérez les cookies selon leur finalité.",
  "category.necessary.name": "Nécessaires",
  "category.necessary.description": "Indispensables au fonctionnement du site.",
  "category.functional.name": "Fonctionnels",
  "category.functional.description":
    "Mémorisent vos réglages et améliorent les fonctions.",
  "category.analytics.name": "Analyse",
  "category.analytics.description":
    "Nous aident à comprendre l’utilisation du site.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Permettent des publicités pertinentes.",
  "optOut.label": "Refuser la vente ou le partage",
  "gpc.honoured": "Le contrôle global de la confidentialité est respecté.",
  "recall.label": "Revoir les choix",
  "gated.placeholder": "Ce contenu nécessite votre autorisation.",
  "gated.allow": "Autoriser le contenu",
} as const satisfies Messages;
export default messages;
export { messages };
