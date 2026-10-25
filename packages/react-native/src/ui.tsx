import type {
  DashboardConfig,
  PlatformCategory,
  PlatformService,
} from "@cookiechimp/core/sync";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
  type ViewStyle,
} from "react-native";
import { store } from "./api";
import { useCookieChimp } from "./hooks";
import { object, type Palette, palette, plain, url } from "./presentation";

export interface Insets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

const RTL_FALLBACK = ["ar", "fa", "he", "ur"];

function useLook(dashboard: DashboardConfig) {
  const scheme = useColorScheme();
  return useMemo(() => {
    const colors = palette(dashboard.theme, scheme);
    const base = dashboard.language.split("-")[0] ?? "";
    const rtl = (dashboard.rtlLanguages ?? RTL_FALLBACK).includes(base);
    return { colors, rtl };
  }, [dashboard, scheme]);
}

function Button({
  label,
  onPress,
  primary,
  colors,
  wide,
}: {
  label: string;
  onPress(): void;
  primary: boolean;
  colors: Palette;
  wide: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        wide && styles.buttonWide,
        {
          backgroundColor: primary
            ? colors.primaryBackground
            : colors.secondaryBackground,
          borderColor: primary
            ? colors.primaryBackground
            : colors.secondaryText,
          borderRadius: colors.buttonRadius,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: primary ? colors.primaryText : colors.secondaryText },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Link({
  href,
  label,
  color,
}: {
  href: string;
  label: string;
  color: string;
}) {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => void Linking.openURL(href).catch(() => {})}
      style={[styles.link, { color }]}
    >
      {label}
    </Text>
  );
}

/** The first-layer consent banner, styled from the dashboard. */
export function ConsentBanner({ insets = {} }: { insets?: Insets }) {
  const { dashboard, bannerOpen, preferencesOpen } = useCookieChimp();
  if (!dashboard) return null;
  return (
    <BannerView
      dashboard={dashboard}
      visible={bannerOpen && !preferencesOpen}
      insets={insets}
    />
  );
}

function BannerView({
  dashboard,
  visible,
  insets,
}: {
  dashboard: DashboardConfig;
  visible: boolean;
  insets: Insets;
}) {
  const { colors, rtl } = useLook(dashboard);
  const engine = store.engine();
  const copy = object(dashboard.copy.consent_modal);
  const gui = object(dashboard.banner.gui_options);
  const buttons = object(dashboard.banner.buttons);
  const privacy = url(dashboard.copy.privacy_policy_url);
  const force = dashboard.banner.force_consent === true;
  const position = String(gui.position ?? "bottom");
  const bar = gui.layout === "bar";
  const placement: ViewStyle["justifyContent"] = position.startsWith("top")
    ? "flex-start"
    : position.startsWith("center") || position.startsWith("middle")
      ? "center"
      : "flex-end";
  const inline =
    gui.button_placement === "inline" || gui.button_placement === "inline wide";
  const equal = gui.equal_weight_buttons !== false;
  const actions = [
    buttons.show_accept_btn !== false && (
      <Button
        key="accept"
        label={plain(copy.accept_btn) || "Accept all"}
        primary
        colors={colors}
        wide={!inline}
        onPress={() => engine?.acceptAll()}
      />
    ),
    buttons.show_accept_necessary_btn !== false && (
      <Button
        key="reject"
        label={plain(copy.reject_btn) || "Reject optional"}
        primary={equal}
        colors={colors}
        wide={!inline}
        onPress={() => engine?.rejectAll()}
      />
    ),
    buttons.show_preferences_btn !== false && (
      <Button
        key="preferences"
        label={plain(copy.preferences_btn) || "Customize"}
        primary={false}
        colors={colors}
        wide={!inline}
        onPress={() => engine?.showPreferences()}
      />
    ),
  ].filter(Boolean);
  if (gui.swap_buttons === true) actions.reverse();
  const additional = plain(copy.additional_description);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (!force) engine?.hideBanner();
      }}
    >
      <View
        style={[
          styles.overlay,
          {
            justifyContent: placement,
            paddingTop: (insets.top ?? 0) + (bar ? 0 : 16),
            paddingBottom: (insets.bottom ?? 0) + (bar ? 0 : 16),
            paddingLeft: (insets.left ?? 0) + (bar ? 0 : 16),
            paddingRight: (insets.right ?? 0) + (bar ? 0 : 16),
          },
          force && styles.backdrop,
        ]}
        pointerEvents="box-none"
      >
        <View
          accessibilityViewIsModal
          accessibilityLanguage={dashboard.language || undefined}
          testID="cookiechimp-banner"
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderRadius: bar ? 0 : colors.cardRadius,
              direction: rtl ? "rtl" : "ltr",
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.heading }]}
            >
              {plain(copy.title) || "Privacy choices"}
            </Text>
            {buttons.show_close_btn === true && !force && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={plain(copy.close_btn) || "Close"}
                hitSlop={12}
                onPress={() => engine?.hideBanner()}
              >
                <Text style={[styles.close, { color: colors.text }]}>×</Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            style={styles.copy}
            contentContainerStyle={styles.copyContent}
          >
            <Text style={[styles.body, { color: colors.text }]}>
              {plain(copy.description) ||
                "We use technologies like cookies and SDKs to run this app. Choose which optional ones may be used."}
            </Text>
            {additional ? (
              <Text style={[styles.body, { color: colors.text }]}>
                {additional}
              </Text>
            ) : null}
            {privacy && (
              <Link href={privacy} label="Privacy policy" color={colors.link} />
            )}
          </ScrollView>
          <View style={[styles.actions, inline && styles.actionsInline]}>
            {actions}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type Draft = {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
};

function Row({
  title,
  description,
  value,
  disabled,
  onToggle,
  colors,
  children,
}: {
  title: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  colors: Palette;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = !!description || !!children;
  return (
    <View style={[styles.row, { borderColor: `${colors.text}33` }]}>
      <View style={styles.rowHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: expandable ? open : undefined }}
          accessibilityLabel={title}
          disabled={!expandable}
          onPress={() => setOpen(!open)}
          style={styles.rowTitle}
        >
          <Text style={[styles.rowTitleText, { color: colors.heading }]}>
            {expandable ? (open ? "− " : "+ ") : ""}
            {title}
          </Text>
        </Pressable>
        {onToggle && (
          <Switch
            accessibilityLabel={title}
            value={value === true}
            disabled={disabled}
            onValueChange={onToggle}
            trackColor={{ true: colors.primaryBackground }}
          />
        )}
      </View>
      {open && (
        <View style={styles.rowBody}>
          {description ? (
            <Text style={[styles.body, { color: colors.text }]}>
              {plain(description)}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </View>
  );
}

function ServiceDetails({
  service,
  colors,
}: {
  service: PlatformService;
  colors: Palette;
}) {
  const privacy = url(service.privacy_policy_url);
  return (
    <View>
      {service.company ? (
        <Text style={[styles.meta, { color: colors.text }]}>
          {plain(service.company)}
        </Text>
      ) : null}
      {service.storage_items.map((item) => (
        <Text key={item.name} style={[styles.meta, { color: colors.text }]}>
          {[item.name, item.duration && plain(item.duration)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ))}
      {privacy && (
        <Link href={privacy} label="Privacy policy" color={colors.link} />
      )}
    </View>
  );
}

/** The second-layer preferences screen, styled from the dashboard. */
export function ConsentPreferences({
  consentIdLabel = "Your consent ID",
}: {
  consentIdLabel?: string;
}) {
  const { dashboard, consent, preferencesOpen } = useCookieChimp();
  const engine = store.engine();
  const [draft, setDraft] = useState<Draft>({ categories: {}, services: {} });
  useEffect(() => {
    if (!preferencesOpen || !consent) return;
    setDraft({
      categories: { ...consent.categories },
      services: { ...consent.services },
    });
  }, [preferencesOpen, consent]);
  if (!dashboard) return null;
  return (
    <PreferencesView
      dashboard={dashboard}
      visible={preferencesOpen}
      draft={draft}
      setDraft={setDraft}
      consentId={consent?.consentId}
      consentIdLabel={consentIdLabel}
      onClose={() => engine?.hidePreferences()}
      onSave={() => engine?.save(draft)}
      onAcceptAll={() => engine?.acceptAll()}
      onRejectAll={() => engine?.rejectAll()}
    />
  );
}

function PreferencesView({
  dashboard,
  visible,
  draft,
  setDraft,
  consentId,
  consentIdLabel,
  onClose,
  onSave,
  onAcceptAll,
  onRejectAll,
}: {
  dashboard: DashboardConfig;
  visible: boolean;
  draft: Draft;
  setDraft: (update: (previous: Draft) => Draft) => void;
  consentId?: string;
  consentIdLabel: string;
  onClose(): void;
  onSave(): void;
  onAcceptAll(): void;
  onRejectAll(): void;
}) {
  const { colors, rtl } = useLook(dashboard);
  const copy = object(dashboard.copy.preferences_modal);
  const bannerCopy = object(dashboard.copy.consent_modal);
  const gui = object(dashboard.banner.preferences_gui_options);
  const buttons = object(dashboard.banner.preferences_buttons);
  const vendorControls = gui.control_level === "category_and_services";
  const showServices = vendorControls || gui.show_services !== false;
  const privacy = url(dashboard.copy.privacy_policy_url);
  const toggleCategory = (category: PlatformCategory) =>
    setDraft((previous) => {
      const enabled = !previous.categories[category.slug];
      return {
        categories: { ...previous.categories, [category.slug]: enabled },
        services: {
          ...previous.services,
          ...Object.fromEntries(
            category.services.map((service) => [service.consent_key, enabled]),
          ),
        },
      };
    });
  const toggleService = (
    category: PlatformCategory,
    service: PlatformService,
  ) =>
    setDraft((previous) => {
      const services = {
        ...previous.services,
        [service.consent_key]: !previous.services[service.consent_key],
      };
      return {
        services,
        categories: {
          ...previous.categories,
          [category.slug]: category.services.some(
            (vendor) => services[vendor.consent_key],
          ),
        },
      };
    });
  const equal = gui.equal_weight_buttons !== false;
  const moreInfo = plain(copy.more_info);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View
        testID="cookiechimp-preferences"
        accessibilityLanguage={dashboard.language || undefined}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            direction: rtl ? "rtl" : "ltr",
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.heading }]}
          >
            {plain(copy.title) || "Privacy preferences"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={plain(copy.close_btn) || "Close"}
            hitSlop={12}
            onPress={onClose}
          >
            <Text style={[styles.close, { color: colors.text }]}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={[styles.body, { color: colors.text }]}>
            {plain(copy.description) ||
              "Choose consent by category or vendor. Expand an item to see its details."}
          </Text>
          {privacy && (
            <Link href={privacy} label="Privacy policy" color={colors.link} />
          )}
          {(dashboard.preferences ?? []).map((category) => (
            <Row
              key={category.slug}
              title={category.name}
              description={category.description}
              value={
                category.required || draft.categories[category.slug] === true
              }
              disabled={category.required}
              onToggle={() => toggleCategory(category)}
              colors={colors}
            >
              {showServices && category.services.length > 0
                ? category.services.map((service) => (
                    <Row
                      key={service.consent_key}
                      title={service.name}
                      description={service.description}
                      value={
                        category.required ||
                        draft.services[service.consent_key] === true
                      }
                      disabled={category.required}
                      onToggle={
                        vendorControls
                          ? () => toggleService(category, service)
                          : undefined
                      }
                      colors={colors}
                    >
                      <ServiceDetails service={service} colors={colors} />
                    </Row>
                  ))
                : null}
            </Row>
          ))}
          {plain(copy.more_info_title) ? (
            <Text style={[styles.subtitle, { color: colors.heading }]}>
              {plain(copy.more_info_title)}
            </Text>
          ) : null}
          {moreInfo ? (
            <Text style={[styles.body, { color: colors.text }]}>
              {moreInfo}
            </Text>
          ) : null}
          {consentId ? (
            <Text selectable style={[styles.meta, { color: colors.text }]}>
              {consentIdLabel}: {consentId}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.actions}>
          {buttons.show_accept_btn !== false && (
            <Button
              label={
                plain(copy.accept_btn) ||
                plain(bannerCopy.accept_btn) ||
                "Accept all"
              }
              primary
              colors={colors}
              wide
              onPress={onAcceptAll}
            />
          )}
          {buttons.show_accept_necessary_btn !== false && (
            <Button
              label={
                plain(copy.reject_btn) ||
                plain(bannerCopy.reject_btn) ||
                "Reject optional"
              }
              primary={equal}
              colors={colors}
              wide
              onPress={onRejectAll}
            />
          )}
          {buttons.show_save_preferences_btn !== false && (
            <Button
              label={plain(copy.save_btn) || "Save preferences"}
              primary={false}
              colors={colors}
              wide
              onPress={onSave}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  card: {
    maxHeight: "85%",
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  subtitle: { fontSize: 17, fontWeight: "600", marginTop: 12 },
  close: { fontSize: 28, lineHeight: 30, paddingHorizontal: 4 },
  copy: { flexGrow: 0 },
  copyContent: { gap: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  link: { fontSize: 15, textDecorationLine: "underline", paddingVertical: 4 },
  actions: { gap: 8 },
  actionsInline: { flexDirection: "row", flexWrap: "wrap" },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  buttonWide: { alignSelf: "stretch" },
  buttonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  sheet: { flex: 1, padding: 20, paddingTop: 24, gap: 12 },
  sheetContent: { gap: 8, paddingBottom: 16 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
  },
  rowTitle: { flex: 1, minHeight: 44, justifyContent: "center" },
  rowTitleText: { fontSize: 16, fontWeight: "600" },
  rowBody: { paddingStart: 16, paddingBottom: 8, gap: 4 },
});
