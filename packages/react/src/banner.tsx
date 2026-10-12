"use client";

import { Banner } from "./headless";
import { useTranslations } from "./index";

export type BannerPosition =
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | "center";
export interface CookieBannerLabels {
  accept?: string;
  reject?: string;
  customize?: string;
}
export interface CookieBannerProps {
  title?: string;
  description?: string;
  labels?: CookieBannerLabels;
  position?: BannerPosition;
  modal?: boolean;
}

const positions = new Set<BannerPosition>([
  "bottom",
  "bottom-left",
  "bottom-right",
  "center",
]);
function invalid(message: string) {
  const text = `Invalid CookieBanner props: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new Error(text);
  console.warn(text);
}

export function CookieBanner({
  title,
  description,
  labels = {},
  position = "bottom",
  modal = false,
}: CookieBannerProps) {
  if (title !== undefined && typeof title !== "string")
    invalid("title must be a string");
  if (description !== undefined && typeof description !== "string")
    invalid("description must be a string");
  if (!positions.has(position)) {
    invalid("position must be bottom, bottom-left, bottom-right, or center");
    position = "bottom";
  }
  if (!labels || typeof labels !== "object") {
    invalid("labels must be an object");
    labels = {};
  }
  const { t } = useTranslations();
  title ??= t("banner.title");
  description ??= t("banner.description");
  return (
    <Banner.Root
      className="cc-banner"
      data-cc-position={position}
      modal={modal}
    >
      <div className="cc-banner__copy">
        <Banner.Title className="cc-title">{title}</Banner.Title>
        <Banner.Description className="cc-description">
          {description}
        </Banner.Description>
      </div>
      <div className="cc-actions">
        <Banner.Customize className="cc-button cc-button--secondary">
          {labels.customize ?? t("banner.customize")}
        </Banner.Customize>
        <Banner.RejectAll className="cc-button cc-button--secondary">
          {labels.reject ?? t("banner.rejectAll")}
        </Banner.RejectAll>
        <Banner.AcceptAll className="cc-button cc-button--primary">
          {labels.accept ?? t("banner.acceptAll")}
        </Banner.AcceptAll>
      </div>
    </Banner.Root>
  );
}
