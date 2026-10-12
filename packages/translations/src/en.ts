import type { Messages } from "./index";

const messages = {
  "banner.title": "Privacy choices",
  "banner.description": "Choose which cookies may be used.",
  "banner.acceptAll": "Accept all cookies",
  "banner.rejectAll": "Reject optional",
  "banner.customize": "Customize",
  "banner.save": "Save",
  "banner.close": "Close",
  "preferences.title": "Cookie preferences",
  "preferences.description": "Control cookies by purpose.",
  "category.necessary.name": "Necessary",
  "category.necessary.description": "Needed for this site.",
  "category.functional.name": "Functional",
  "category.functional.description": "Remembers settings.",
  "category.analytics.name": "Analytics",
  "category.analytics.description": "Measures site use.",
  "category.marketing.name": "Marketing",
  "category.marketing.description": "Supports advertising.",
  "optOut.label": "Opt out of sale or sharing",
  "gpc.honoured": "Global Privacy Control has been honoured.",
  "recall.label": "Review cookie choices",
  "gated.placeholder": "This content needs your permission.",
  "gated.allow": "Allow content",
} as const satisfies Messages;
export default messages;
export { messages };
