import type { DashboardConfig } from "@cookiechimp/core/sync";
import type { ReactNode } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { store } from "../api";
import { useCookieChimp } from "../hooks";
import {
  object,
  type Palette,
  plain,
  poweredBy,
  rich,
  url,
  withoutBranding,
} from "../presentation";
import {
  Button,
  styles as base,
  CloseButton,
  CookieMark,
  Link,
  Logo,
  PoweredBy,
  Rich,
  tint,
} from "./controls";
import { type Insets, useLook } from "./look";
import { usePresence } from "./motion";

export type BannerLayout = "box" | "cloud" | "bar" | "fullscreen";
export type ButtonPlacement = "stacked" | "inline" | "wide";

export interface BannerDisplay {
  layout: BannerLayout;
  placement: ButtonPlacement;
  vertical: "top" | "middle" | "bottom";
  horizontal: "left" | "center" | "right";
}

/** How the dashboard asks the first-layer banner to be laid out. */
export function bannerDisplay(gui: Record<string, unknown>): BannerDisplay {
  const layout: BannerLayout =
    gui.layout === "fullscreen" ||
    gui.layout === "cloud" ||
    gui.layout === "bar"
      ? gui.layout
      : "box";
  const placement: ButtonPlacement =
    gui.button_placement === "wide" || gui.button_placement === "inline wide"
      ? "wide"
      : gui.button_placement === "inline"
        ? "inline"
        : "stacked";
  const [y = "bottom", x = "center"] = String(gui.position ?? "")
    .replace("_", " ")
    .split(" ");
  return {
    layout,
    placement,
    vertical:
      layout === "fullscreen"
        ? "middle"
        : y === "top"
          ? "top"
          : y === "middle" && layout !== "bar"
            ? "middle"
            : "bottom",
    horizontal:
      layout === "bar" || layout === "fullscreen"
        ? "center"
        : x === "left" || x === "right"
          ? x
          : "center",
  };
}

interface Action {
  key: string;
  label: string;
  primary: boolean;
  onPress(): void;
}

function actionsFor(dashboard: DashboardConfig): Action[] {
  const engine = store.engine();
  const copy = object(dashboard.copy.consent_modal);
  const gui = object(dashboard.banner.gui_options);
  const buttons = object(dashboard.banner.buttons);
  const equal = gui.equal_weight_buttons !== false;
  const actions: Action[] = [];
  if (buttons.show_accept_btn !== false)
    actions.push({
      key: "accept",
      label: plain(copy.accept_btn) || "Accept all",
      primary: true,
      onPress: () => engine?.acceptAll(),
    });
  if (buttons.show_accept_necessary_btn !== false)
    actions.push({
      key: "reject",
      label: plain(copy.reject_btn) || "Reject optional",
      primary: equal,
      onPress: () => engine?.rejectAll(),
    });
  if (buttons.show_preferences_btn !== false)
    actions.push({
      key: "preferences",
      label: plain(copy.preferences_btn) || "Customize",
      primary: false,
      onPress: () => engine?.showPreferences(),
    });
  // Same order as the web banner: swapped puts preferences first.
  if (gui.swap_buttons === true) actions.reverse();
  return actions;
}

function Actions({
  actions,
  placement,
  colors,
}: {
  actions: Action[];
  placement: ButtonPlacement;
  colors: Palette;
}) {
  const button = (action: Action, style?: ViewStyle) => (
    <Button
      key={action.key}
      label={action.label}
      primary={action.primary}
      colors={colors}
      onPress={action.onPress}
      style={style}
    />
  );
  if (placement === "stacked")
    return <View style={styles.stack}>{actions.map((a) => button(a))}</View>;
  if (placement === "wide")
    return (
      <View style={styles.wide}>
        {actions.map((a) => button(a, styles.wideButton))}
      </View>
    );
  // Inline: the two decisions side by side, preferences across the width.
  const decisions = actions.filter((action) => action.key !== "preferences");
  const rest = actions.filter((action) => action.key === "preferences");
  return (
    <View style={styles.stack}>
      {decisions.length > 0 && (
        <View style={styles.row}>
          {decisions.map((a) => button(a, styles.flex))}
        </View>
      )}
      {rest.map((a) => button(a))}
    </View>
  );
}

function Copy({
  dashboard,
  colors,
  large,
}: {
  dashboard: DashboardConfig;
  colors: Palette;
  large?: boolean;
}) {
  const copy = object(dashboard.copy.consent_modal);
  const footer = object(dashboard.banner.footer);
  const footerContent = withoutBranding(copy.footer ?? footer.content);
  const privacy = url(dashboard.copy.privacy_policy_url);
  const bodyStyle = large ? styles.largeBody : undefined;
  return (
    <View style={styles.copy}>
      <Rich
        value={
          copy.description ||
          "We use technologies like cookies and SDKs to run this app. Choose which optional ones may be used."
        }
        colors={colors}
        style={bodyStyle}
      />
      <Rich
        value={copy.additional_description}
        colors={colors}
        style={bodyStyle}
      />
      {footer.enabled !== false &&
        (rich(footerContent).length ? (
          <Rich value={footerContent} colors={colors} style={base.small} />
        ) : privacy ? (
          <Link href={privacy} label="Privacy policy" colors={colors} />
        ) : null)}
    </View>
  );
}

/** The first-layer consent banner, styled from the dashboard. */
export function ConsentBanner({ insets = {} }: { insets?: Insets }) {
  const { dashboard, bannerOpen, preferencesOpen } = useCookieChimp();
  const visible = !!dashboard && bannerOpen && !preferencesOpen;
  const { mounted, progress } = usePresence(visible);
  if (!dashboard || !mounted) return null;
  const display = bannerDisplay(object(dashboard.banner.gui_options));
  return display.layout === "fullscreen" ? (
    <FullScreenBanner
      dashboard={dashboard}
      display={display}
      insets={insets}
      progress={progress}
    />
  ) : (
    <FloatingBanner
      dashboard={dashboard}
      display={display}
      insets={insets}
      progress={progress}
    />
  );
}

function Shell({
  dashboard,
  progress,
  children,
}: {
  dashboard: DashboardConfig;
  progress: Animated.Value;
  children: ReactNode;
}) {
  const force = dashboard.banner.force_consent === true;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!force) store.engine()?.hideBanner();
      }}
    >
      {force && (
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: progress }]}
        />
      )}
      {children}
    </Modal>
  );
}

function Header({
  dashboard,
  colors,
  large,
}: {
  dashboard: DashboardConfig;
  colors: Palette;
  large?: boolean;
}) {
  const copy = object(dashboard.copy.consent_modal);
  const buttons = object(dashboard.banner.buttons);
  const closable =
    buttons.show_close_btn === true && dashboard.banner.force_consent !== true;
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[
          large ? styles.largeTitle : styles.title,
          { color: colors.heading },
        ]}
      >
        {plain(copy.title) || "Privacy choices"}
      </Text>
      {closable && (
        <CloseButton
          label={plain(copy.close_btn) || "Close"}
          colors={colors}
          onPress={() => store.engine()?.hideBanner()}
        />
      )}
    </View>
  );
}

function FloatingBanner({
  dashboard,
  display,
  insets,
  progress,
}: {
  dashboard: DashboardConfig;
  display: BannerDisplay;
  insets: Insets;
  progress: Animated.Value;
}) {
  const { colors, rtl } = useLook(dashboard);
  const window = useWindowDimensions();
  const bar = display.layout === "bar";
  const cloud = display.layout === "cloud";
  const gap = bar ? 0 : 12;
  const side = cloud && window.width >= 640;
  const offset =
    display.vertical === "top" ? -1 : display.vertical === "middle" ? 0.5 : 1;
  const distance = bar ? 120 : 40;
  return (
    <Shell dashboard={dashboard} progress={progress}>
      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          {
            justifyContent:
              display.vertical === "top"
                ? "flex-start"
                : display.vertical === "middle"
                  ? "center"
                  : "flex-end",
            alignItems:
              display.horizontal === "left"
                ? "flex-start"
                : display.horizontal === "right"
                  ? "flex-end"
                  : "center",
            paddingTop: bar ? 0 : (insets.top ?? 0) + gap,
            paddingBottom: bar ? 0 : (insets.bottom ?? 0) + gap,
            paddingLeft: bar ? 0 : (insets.left ?? 0) + gap,
            paddingRight: bar ? 0 : (insets.right ?? 0) + gap,
          },
        ]}
      >
        <Animated.View
          accessibilityViewIsModal
          accessibilityLanguage={dashboard.language || undefined}
          testID="cookiechimp-banner"
          style={[
            styles.card,
            bar ? styles.bar : cloud ? styles.cloud : styles.box,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderRadius: bar ? 0 : colors.cardRadius,
              direction: rtl ? "rtl" : "ltr",
              maxHeight: window.height * (bar ? 0.7 : 0.85),
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [offset * distance, 0],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [display.vertical === "middle" ? 0.96 : 1, 1],
                  }),
                },
              ],
            },
            bar && {
              paddingTop:
                20 + (display.vertical === "top" ? (insets.top ?? 0) : 0),
              paddingBottom:
                20 + (display.vertical === "bottom" ? (insets.bottom ?? 0) : 0),
              paddingLeft: 20 + (insets.left ?? 0),
              paddingRight: 20 + (insets.right ?? 0),
              borderTopWidth: display.vertical === "bottom" ? 1 : 0,
              borderBottomWidth: display.vertical === "top" ? 1 : 0,
            },
          ]}
        >
          <View style={[styles.content, side && styles.contentSide]}>
            <View style={[styles.text, side && styles.flex]}>
              <Logo colors={colors} />
              <Header dashboard={dashboard} colors={colors} />
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Copy dashboard={dashboard} colors={colors} />
              </ScrollView>
            </View>
            <View style={side ? styles.sideActions : undefined}>
              <Actions
                actions={actionsFor(dashboard)}
                placement={display.placement}
                colors={colors}
              />
            </View>
          </View>
          {poweredBy(dashboard.banner) && (
            <View style={styles.branding}>
              <PoweredBy colors={colors} />
            </View>
          )}
        </Animated.View>
      </View>
    </Shell>
  );
}

function FullScreenBanner({
  dashboard,
  display,
  insets,
  progress,
}: {
  dashboard: DashboardConfig;
  display: BannerDisplay;
  insets: Insets;
  progress: Animated.Value;
}) {
  const { colors, rtl } = useLook(dashboard);
  const rise = (distance: number) => ({
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });
  return (
    <Shell dashboard={dashboard} progress={progress}>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLanguage={dashboard.language || undefined}
        testID="cookiechimp-banner"
        style={[
          styles.fullscreen,
          {
            backgroundColor: colors.background,
            direction: rtl ? "rtl" : "ltr",
            opacity: progress,
            paddingTop: (insets.top ?? 0) + 12,
            paddingBottom: (insets.bottom ?? 0) + 16,
            paddingLeft: (insets.left ?? 0) + 24,
            paddingRight: (insets.right ?? 0) + 24,
          },
        ]}
      >
        <View style={styles.fullscreenInner}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.fullscreenScroll}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.fullscreenCopy, rise(24)]}>
              {colors.logo ? (
                <Logo colors={colors} />
              ) : (
                <View
                  style={[styles.mark, { backgroundColor: tint(colors, 0.08) }]}
                >
                  <CookieMark color={colors.primaryBackground} size={34} />
                </View>
              )}
              <Header dashboard={dashboard} colors={colors} large />
              <Copy dashboard={dashboard} colors={colors} large />
            </Animated.View>
          </ScrollView>
          <Animated.View
            style={[
              styles.fullscreenActions,
              { borderColor: colors.border },
              rise(40),
            ]}
          >
            <Actions
              actions={actionsFor(dashboard)}
              placement={
                display.placement === "wide" ? "inline" : display.placement
              }
              colors={colors}
            />
            {poweredBy(dashboard.banner) && (
              <View style={styles.branding}>
                <PoweredBy colors={colors} />
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    width: "100%",
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  box: { maxWidth: 440 },
  cloud: { maxWidth: 820 },
  bar: { borderLeftWidth: 0, borderRightWidth: 0 },
  content: { gap: 16, flexShrink: 1 },
  contentSide: { flexDirection: "row", alignItems: "flex-end", gap: 24 },
  text: { gap: 10, flexShrink: 1 },
  sideActions: { width: 260 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  largeTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    flexShrink: 1,
    letterSpacing: -0.5,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingBottom: 2 },
  copy: { gap: 10 },
  largeBody: { fontSize: 16, lineHeight: 25 },
  stack: { gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  wide: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wideButton: { flexGrow: 1, minWidth: 96 },
  fullscreen: { flex: 1, alignItems: "center" },
  fullscreenInner: { flex: 1, width: "100%", maxWidth: 560 },
  fullscreenScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  fullscreenCopy: { gap: 18 },
  fullscreenActions: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  branding: { marginTop: 14, alignItems: "center" },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
