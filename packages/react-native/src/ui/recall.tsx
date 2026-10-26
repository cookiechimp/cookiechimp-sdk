import { Animated, Pressable, StyleSheet } from "react-native";
import { store } from "../api";
import { useCookieChimp } from "../hooks";
import { object, plain } from "../presentation";
import { CookieMark } from "./controls";
import { type Insets, useLook } from "./look";
import { usePresence } from "./motion";

/**
 * A floating button that reopens the preferences after a decision, placed
 * where the dashboard's floating preferences icon setting puts it. It hides
 * itself when the dashboard turns the floating icon off.
 */
export function ConsentRecallButton({ insets = {} }: { insets?: Insets }) {
  const { dashboard, decided, bannerOpen, preferencesOpen } = useCookieChimp();
  const gui = object(dashboard?.banner.preferences_gui_options);
  const visible =
    !!dashboard &&
    decided &&
    !bannerOpen &&
    !preferencesOpen &&
    gui.show_floating_icon !== false;
  const { mounted, progress } = usePresence(visible, 220);
  if (!dashboard || !mounted) return null;
  return (
    <RecallButton
      dashboard={dashboard}
      insets={insets}
      progress={progress}
      right={gui.floating_icon_position === "bottom_right"}
    />
  );
}

function RecallButton({
  dashboard,
  insets,
  progress,
  right,
}: {
  dashboard: NonNullable<ReturnType<typeof useCookieChimp>["dashboard"]>;
  insets: Insets;
  progress: Animated.Value;
  right: boolean;
}) {
  const { colors } = useLook(dashboard);
  const label =
    plain(object(dashboard.copy.preferences_modal).title) ||
    "Privacy preferences";
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.anchor,
        right
          ? { right: (insets.right ?? 0) + 16 }
          : { left: (insets.left ?? 0) + 16 },
        {
          bottom: (insets.bottom ?? 0) + 16,
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="cookiechimp-recall"
        onPress={() => store.engine()?.showPreferences()}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.primaryBackground,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <CookieMark color={colors.primaryText} size={24} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute" },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
