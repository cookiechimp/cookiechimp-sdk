import type {
  DashboardConfig,
  PlatformCategory,
  PlatformService,
  PlatformStorageItem,
} from "@cookiechimp/core/sync";
import { type ReactNode, useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { store } from "../api";
import { useCookieChimp } from "../hooks";
import { object, type Palette, plain, poweredBy, url } from "../presentation";
import {
  Button,
  styles as base,
  Chevron,
  CloseButton,
  Link,
  Logo,
  PoweredBy,
  Rich,
  Toggle,
} from "./controls";
import { type Insets, useLook } from "./look";
import { Collapse, usePresence, useProgress } from "./motion";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

type Draft = {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
};

/** The second-layer preferences screen, styled from the dashboard. */
export function ConsentPreferences({
  consentIdLabel = "Your consent ID",
  insets = {},
}: {
  consentIdLabel?: string;
  insets?: Insets;
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
  const { mounted, progress } = usePresence(!!dashboard && preferencesOpen);
  if (!dashboard || !mounted) return null;
  return (
    <PreferencesView
      dashboard={dashboard}
      progress={progress}
      insets={insets}
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

/** A tappable header that expands its details with an animation. */
function Disclosure({
  title,
  subtitle,
  toggle,
  colors,
  expandable,
  children,
  nested,
}: {
  title: string;
  subtitle?: string;
  toggle?: ReactNode;
  colors: Palette;
  expandable: boolean;
  children?: ReactNode;
  nested?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const progress = useProgress(open);
  return (
    <View
      style={
        nested
          ? [styles.vendor, { borderColor: colors.border }]
          : [
              styles.category,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: Math.min(colors.cardRadius + 4, 20),
              },
            ]
      }
    >
      <View style={styles.disclosureRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: expandable ? open : undefined }}
          disabled={!expandable}
          onPress={() => setOpen(!open)}
          style={styles.disclosureLabel}
        >
          {expandable && <Chevron progress={progress} color={colors.heading} />}
          <View style={styles.flex}>
            <Text
              style={[
                nested ? styles.vendorName : styles.categoryName,
                { color: colors.heading },
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[base.small, { color: colors.text }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {toggle}
      </View>
      {expandable && (
        <Collapse open={open} progress={progress}>
          <View style={nested ? styles.vendorBody : styles.categoryBody}>
            {children}
          </View>
        </Collapse>
      )}
    </View>
  );
}

function Fact({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Palette;
}) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.heading }]}>{value}</Text>
    </View>
  );
}

function StorageItems({
  items,
  colors,
}: {
  items: PlatformStorageItem[];
  colors: Palette;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.items}>
      {items.map((item) => (
        <View
          key={JSON.stringify(item)}
          style={[
            styles.item,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              borderRadius: Math.min(colors.cardRadius, 12),
            },
          ]}
        >
          <Text selectable style={[styles.itemName, { color: colors.heading }]}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={[base.small, { color: colors.text }]}>
              {plain(item.description)}
            </Text>
          ) : null}
          <View style={styles.facts}>
            {item.type ? (
              <Fact
                label="Type"
                value={item.type.replaceAll("_", " ")}
                colors={colors}
              />
            ) : null}
            {item.duration ? (
              <Fact
                label="Duration"
                value={plain(item.duration)}
                colors={colors}
              />
            ) : null}
            {item.company ? (
              <Fact
                label="Company"
                value={plain(item.company)}
                colors={colors}
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function VendorDetails({
  service,
  colors,
}: {
  service: PlatformService;
  colors: Palette;
}) {
  const privacy = url(service.privacy_policy_url);
  return (
    <>
      <Rich value={service.description} colors={colors} style={base.small} />
      {privacy && (
        <Link href={privacy} label="Privacy policy" colors={colors} />
      )}
      <StorageItems items={service.storage_items} colors={colors} />
    </>
  );
}

function PreferencesView({
  dashboard,
  progress,
  insets,
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
  progress: Animated.Value;
  insets: Insets;
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
  const window = useWindowDimensions();
  const copy = object(dashboard.copy.preferences_modal);
  const bannerCopy = object(dashboard.copy.consent_modal);
  const gui = object(dashboard.banner.preferences_gui_options);
  const buttons = object(dashboard.banner.preferences_buttons);
  const vendorControls = gui.control_level !== "category_only";
  const showServices = vendorControls || gui.show_services !== false;
  const privacy = url(dashboard.copy.privacy_policy_url);
  // A full screen banner opens a full screen preferences page to match.
  const fullscreen =
    object(dashboard.banner.gui_options).layout === "fullscreen";
  const panel = !fullscreen && gui.layout === "bar";
  const fromRight = gui.position === "right" ? !rtl : rtl;
  const panelWidth = Math.min(window.width, 460);
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
  const showAccept = buttons.show_accept_btn !== false;
  const showReject = buttons.show_accept_necessary_btn !== false;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {!fullscreen && (
        <Animated.View
          style={[styles.backdrop, { opacity: progress }]}
          pointerEvents="none"
        />
      )}
      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          fullscreen
            ? undefined
            : panel
              ? { alignItems: fromRight ? "flex-end" : "flex-start" }
              : {
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: (insets.top ?? 0) + 16,
                  paddingBottom: (insets.bottom ?? 0) + 16,
                  paddingLeft: (insets.left ?? 0) + 12,
                  paddingRight: (insets.right ?? 0) + 12,
                },
        ]}
      >
        <Animated.View
          testID="cookiechimp-preferences"
          accessibilityViewIsModal
          accessibilityLanguage={dashboard.language || undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              direction: rtl ? "rtl" : "ltr",
            },
            fullscreen
              ? {
                  flex: 1,
                  borderWidth: 0,
                  paddingTop: insets.top ?? 0,
                  paddingBottom: insets.bottom ?? 0,
                  paddingLeft: insets.left ?? 0,
                  paddingRight: insets.right ?? 0,
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [window.height, 0],
                      }),
                    },
                  ],
                }
              : panel
                ? {
                    width: panelWidth,
                    height: "100%",
                    paddingTop: (insets.top ?? 0) + 8,
                    paddingBottom: insets.bottom ?? 0,
                    transform: [
                      {
                        translateX: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            fromRight ? panelWidth : -panelWidth,
                            0,
                          ],
                        }),
                      },
                    ],
                  }
                : {
                    width: "100%",
                    maxWidth: 560,
                    maxHeight: "100%",
                    borderRadius: colors.cardRadius,
                    opacity: progress,
                    transform: [
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
                        }),
                      },
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.97, 1],
                        }),
                      },
                    ],
                  },
          ]}
        >
          <View style={[styles.head, { borderColor: colors.border }]}>
            <View style={styles.headTitle}>
              <Logo colors={colors} />
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.heading }]}
              >
                {plain(copy.title) || "Privacy preferences"}
              </Text>
            </View>
            <CloseButton
              label={plain(copy.close_btn) || "Close"}
              colors={colors}
              onPress={onClose}
            />
          </View>
          <ScrollView
            style={[styles.body, (fullscreen || panel) && styles.flex]}
            contentContainerStyle={styles.bodyContent}
          >
            <Rich
              value={
                copy.description ||
                "Choose consent by category or vendor. Expand an item to see its details."
              }
              colors={colors}
            />
            {privacy && (
              <Link href={privacy} label="Privacy policy" colors={colors} />
            )}
            <View style={styles.categories}>
              {(dashboard.preferences ?? []).map((category) => (
                <Disclosure
                  key={category.slug}
                  title={category.name}
                  colors={colors}
                  expandable={
                    !!category.description ||
                    (showServices &&
                      (category.services.length > 0 ||
                        category.storage_items.length > 0))
                  }
                  toggle={
                    <Toggle
                      label={category.name}
                      value={
                        category.required ||
                        draft.categories[category.slug] === true
                      }
                      disabled={category.required}
                      onChange={() => toggleCategory(category)}
                      colors={colors}
                    />
                  }
                >
                  <Rich
                    value={category.description}
                    colors={colors}
                    style={base.small}
                  />
                  {showServices && (
                    <View style={styles.vendors}>
                      {category.services.map((service) => (
                        <Disclosure
                          key={service.consent_key}
                          nested
                          title={service.name}
                          subtitle={plain(service.company)}
                          colors={colors}
                          expandable={
                            !!(
                              service.description ||
                              url(service.privacy_policy_url) ||
                              service.storage_items.length
                            )
                          }
                          toggle={
                            vendorControls ? (
                              <Toggle
                                label={service.name}
                                value={
                                  category.required ||
                                  draft.services[service.consent_key] === true
                                }
                                disabled={category.required}
                                onChange={() =>
                                  toggleService(category, service)
                                }
                                colors={colors}
                              />
                            ) : undefined
                          }
                        >
                          <VendorDetails service={service} colors={colors} />
                        </Disclosure>
                      ))}
                      <StorageItems
                        items={category.storage_items}
                        colors={colors}
                      />
                    </View>
                  )}
                </Disclosure>
              ))}
            </View>
            {plain(copy.more_info_title) ? (
              <Text style={[styles.subtitle, { color: colors.heading }]}>
                {plain(copy.more_info_title)}
              </Text>
            ) : null}
            <Rich value={copy.more_info} colors={colors} />
            {consentId ? (
              <View
                style={[
                  styles.consentId,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: Math.min(colors.cardRadius, 12),
                  },
                ]}
              >
                <Text style={[styles.factLabel, { color: colors.text }]}>
                  {consentIdLabel}
                </Text>
                <Text
                  selectable
                  style={[styles.mono, { color: colors.heading }]}
                >
                  {consentId}
                </Text>
              </View>
            ) : null}
          </ScrollView>
          <View
            style={[
              styles.actions,
              {
                borderColor: colors.border,
                paddingBottom: panel ? 16 + (insets.bottom ?? 0) : 16,
              },
            ]}
          >
            {(showAccept || showReject) && (
              <View style={styles.row}>
                {showReject && (
                  <Button
                    label={
                      plain(copy.reject_btn) ||
                      plain(bannerCopy.reject_btn) ||
                      "Reject optional"
                    }
                    primary={equal}
                    colors={colors}
                    onPress={onRejectAll}
                    style={styles.flex}
                  />
                )}
                {showAccept && (
                  <Button
                    label={
                      plain(copy.accept_btn) ||
                      plain(bannerCopy.accept_btn) ||
                      "Accept all"
                    }
                    primary
                    colors={colors}
                    onPress={onAcceptAll}
                    style={styles.flex}
                  />
                )}
              </View>
            )}
            {buttons.show_save_preferences_btn !== false && (
              <Button
                label={plain(copy.save_btn) || "Save preferences"}
                primary={false}
                colors={colors}
                onPress={onSave}
              />
            )}
            {poweredBy(dashboard.banner) && (
              <View style={styles.branding}>
                <PoweredBy colors={colors} />
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headTitle: { flex: 1, gap: 8 },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 20, gap: 12 },
  categories: { gap: 10, marginTop: 4 },
  category: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  categoryName: { fontSize: 16, fontWeight: "600" },
  categoryBody: { paddingBottom: 14, paddingStart: 22, gap: 10 },
  vendors: { gap: 0 },
  vendor: { borderTopWidth: StyleSheet.hairlineWidth },
  vendorName: { fontSize: 15, fontWeight: "600" },
  vendorBody: { paddingBottom: 12, paddingStart: 22, gap: 10 },
  disclosureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
  },
  disclosureLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 8,
  },
  items: { gap: 8 },
  item: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: MONO,
  },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 6 },
  fact: { gap: 1 },
  factLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  factValue: { fontSize: 13 },
  consentId: { padding: 12, gap: 4, marginTop: 4 },
  mono: { fontSize: 13, fontFamily: MONO },
  branding: { alignItems: "center", marginTop: 4 },
  actions: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", gap: 8 },
});
