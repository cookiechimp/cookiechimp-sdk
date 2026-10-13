import type { DashboardConfig } from "@cookiechimp/core/sync";
import type { Messages } from "@cookiechimp/react";

// Dashboard fields that may hold HTML are only used when they are plain text,
// because messages render as text.
const plain = (value: unknown) =>
  typeof value === "string" &&
  value.trim() &&
  value.length <= 500 &&
  !/[<>]/.test(value)
    ? value
    : undefined;

const MESSAGE_FIELDS: [string, string, string][] = [
  ["consent_modal", "title", "banner.title"],
  ["consent_modal", "description", "banner.description"],
  ["consent_modal", "accept_btn", "banner.acceptAll"],
  ["consent_modal", "reject_btn", "banner.rejectAll"],
  ["consent_modal", "preferences_btn", "banner.customize"],
  ["consent_modal", "close_btn", "banner.close"],
  ["preferences_modal", "title", "preferences.title"],
  ["preferences_modal", "description", "preferences.description"],
  ["preferences_modal", "save_btn", "banner.save"],
];

/** Map the selected banner's plain-text dashboard copy to translation messages. */
export function dashboardMessages(dashboard?: DashboardConfig): Messages {
  const messages: Record<string, string> = {};
  for (const [section, field, key] of MESSAGE_FIELDS) {
    const group = dashboard?.copy[section];
    const value =
      group && typeof group === "object" && Object.hasOwn(group, field)
        ? plain((group as Record<string, unknown>)[field])
        : undefined;
    if (value) messages[key] = value;
  }
  return messages as Messages;
}
