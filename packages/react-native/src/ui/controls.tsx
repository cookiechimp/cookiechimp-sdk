import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { alpha, type Palette, rich } from "../presentation";

const open = (href: string) => void Linking.openURL(href).catch(() => {});

export function Button({
  label,
  onPress,
  primary,
  colors,
  style,
}: {
  label: string;
  onPress(): void;
  primary: boolean;
  colors: Palette;
  style?: ViewStyle;
}) {
  const background = primary
    ? colors.primaryBackground
    : colors.secondaryBackground;
  // An outline keeps a secondary button visible when it matches the card.
  const outlined =
    !primary && alpha(background, 1) === alpha(colors.background, 1);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: outlined ? colors.border : background,
          borderRadius: colors.buttonRadius,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <Text
        numberOfLines={2}
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

/** A switch drawn in the dashboard colors, the same on iOS and Android. */
export function Toggle({
  label,
  value,
  disabled,
  onChange,
  colors,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange(): void;
  colors: Palette;
}) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [value, progress]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: disabled === true }}
      disabled={disabled}
      hitSlop={8}
      onPress={onChange}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.track, colors.primaryBackground],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: value ? colors.primaryText : "#ffffff",
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 18],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Dashboard rich text with tappable links. */
export function Rich({
  value,
  colors,
  style,
}: {
  value: unknown;
  colors: Palette;
  style?: TextStyle;
}) {
  const paragraphs = rich(value);
  if (!paragraphs.length) return null;
  return (
    <View style={styles.rich}>
      {paragraphs.map((spans, index) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs have no identity beyond their order.
          key={index}
          style={[styles.body, { color: colors.text }, style]}
        >
          {spans.map((span, at) => (
            <Text
              // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity beyond their order.
              key={at}
              accessibilityRole={span.href ? "link" : undefined}
              onPress={span.href ? () => open(span.href as string) : undefined}
              style={[
                span.bold && styles.bold,
                span.italic && styles.italic,
                span.href && [styles.link, { color: colors.link }],
              ]}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

export function Link({
  href,
  label,
  colors,
  style,
}: {
  href: string;
  label: string;
  colors: Palette;
  style?: TextStyle;
}) {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => open(href)}
      style={[styles.small, styles.link, { color: colors.link }, style]}
    >
      {label}
    </Text>
  );
}

export function Logo({ colors }: { colors: Palette }) {
  if (!colors.logo) return null;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri: colors.logo }}
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

export function CloseButton({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress(): void;
  colors: Palette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.close,
        { backgroundColor: pressed ? colors.border : colors.surface },
      ]}
    >
      <View style={[styles.closeBar, { backgroundColor: colors.heading }]} />
      <View
        style={[
          styles.closeBar,
          styles.closeBarCross,
          { backgroundColor: colors.heading },
        ]}
      />
    </Pressable>
  );
}

/** A chevron that turns from pointing at the label to pointing down. */
export function Chevron({
  progress,
  color,
}: {
  progress: Animated.Value;
  color: string;
}) {
  return (
    <Animated.View
      style={[
        styles.chevron,
        {
          borderColor: color,
          transform: [
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["-45deg", "45deg"],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** A simple cookie mark, drawn without images or icon fonts. */
export function CookieMark({ color, size }: { color: string; size: number }) {
  const dot = Math.max(3, Math.round(size / 9));
  const at = (x: number, y: number) => ({
    width: dot,
    height: dot,
    borderRadius: dot,
    backgroundColor: color,
    position: "absolute" as const,
    left: x * size - dot / 2,
    top: y * size - dot / 2,
  });
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(2, size / 14),
        borderColor: color,
      }}
    >
      <View style={at(0.32, 0.38)} />
      <View style={at(0.62, 0.3)} />
      <View style={at(0.42, 0.66)} />
      <View style={at(0.7, 0.62)} />
    </View>
  );
}

export const tint = (colors: Palette, opacity: number) =>
  alpha(colors.primaryBackground, opacity);

export const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  rich: { gap: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  link: { textDecorationLine: "underline", fontWeight: "500" },
  logo: { height: 28, width: 140, alignSelf: "flex-start" },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBar: {
    position: "absolute",
    width: 14,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: "45deg" }],
  },
  closeBarCross: { transform: [{ rotate: "-45deg" }] },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    marginHorizontal: 4,
  },
});
