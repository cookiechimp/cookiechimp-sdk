import type { Messages } from "./index";

const messages = {
  "banner.title": "Tus opciones de privacidad",
  "banner.description": "Elige qué cookies puede usar este sitio.",
  "banner.acceptAll": "Aceptar todas",
  "banner.rejectAll": "Rechazar las opcionales",
  "banner.customize": "Personalizar",
  "banner.save": "Guardar opciones",
  "banner.close": "Cerrar",
  "preferences.title": "Preferencias de cookies",
  "preferences.description": "Controla las cookies según su finalidad.",
  "category.necessary.name": "Necesarias",
  "category.necessary.description":
    "Imprescindibles para que el sitio funcione.",
  "category.functional.name": "Funcionales",
  "category.functional.description": "Recuerdan tus ajustes.",
  "category.analytics.name": "Analíticas",
  "category.analytics.description": "Ayudan a entender el uso del sitio.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Permiten mostrar publicidad.",
  "optOut.label": "Rechazar la venta o el uso compartido de datos",
  "gpc.honoured": "Se ha respetado el Control Global de Privacidad.",
  "recall.label": "Revisar opciones",
  "gated.placeholder": "Este contenido necesita tu permiso.",
  "gated.allow": "Permitir contenido",
} as const satisfies Messages;
export default messages;
export { messages };
