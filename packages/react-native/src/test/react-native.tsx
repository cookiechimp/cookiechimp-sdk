// A small DOM stand-in for react-native so components render in happy-dom.
// Accessibility props map to ARIA so tests query what screen readers get.
import type { ReactNode } from "react";

type Props = Record<string, unknown> & { children?: ReactNode };

const aria = (props: Props) => ({
  "data-testid": props.testID as string | undefined,
  role: props.accessibilityRole as string | undefined,
  "aria-label": props.accessibilityLabel as string | undefined,
  "aria-disabled": props.disabled ? true : undefined,
  lang: props.accessibilityLanguage as string | undefined,
  "aria-checked": state(props).checked as boolean | undefined,
  "aria-expanded": state(props).expanded as boolean | undefined,
});
const state = (props: Props) =>
  (props.accessibilityState ?? {}) as Record<string, unknown>;

export const View = ({ children, ...props }: Props) => (
  <div {...aria(props)}>{children}</div>
);
export const ScrollView = View;
export const Image = (props: Props) => (
  <img alt="" src={(props.source as { uri?: string })?.uri} />
);
export const Text = ({ children, onPress, ...props }: Props) => (
  // biome-ignore lint/a11y/noStaticElementInteractions: mirrors RN Text, whose role comes from accessibilityRole.
  // biome-ignore lint/a11y/useKeyWithClickEvents: test stand-in for a touch target.
  <span {...aria(props)} onClick={onPress as () => void}>
    {children}
  </span>
);
export const Pressable = ({ children, onPress, disabled, ...props }: Props) => (
  <button
    type="button"
    {...aria(props)}
    disabled={disabled as boolean}
    onClick={onPress as () => void}
  >
    {children}
  </button>
);
export const Switch = ({ value, onValueChange, disabled, ...props }: Props) => (
  <input
    type="checkbox"
    role="switch"
    aria-checked={value === true}
    aria-label={props.accessibilityLabel as string}
    checked={value === true}
    disabled={disabled as boolean}
    onChange={() => (onValueChange as (next: boolean) => void)(!value)}
  />
);
export const Modal = ({ visible, children }: Props) =>
  visible ? <div role="dialog">{children}</div> : null;

export const StyleSheet = {
  create: <T,>(styles: T) => styles,
  hairlineWidth: 1,
  absoluteFillObject: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};
export const Platform = {
  OS: "ios" as "ios" | "android",
  select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
    options[Platform.OS] ?? options.default,
};
export const useWindowDimensions = () => ({ width: 390, height: 844 });
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove() {} }),
};

// Animations finish at once so tests see the end state synchronously.
class AnimatedValue {
  constructor(public value: number) {}
  interpolate() {
    return this;
  }
}
const finish = (value: AnimatedValue, config: { toValue: number }) => ({
  start(callback?: (result: { finished: boolean }) => void) {
    value.value = config.toValue;
    callback?.({ finished: true });
  },
  stop() {},
});
export const Animated = {
  View,
  Value: AnimatedValue,
  timing: finish,
  spring: finish,
};
export const Easing = {
  out: (easing: unknown) => easing,
  in: (easing: unknown) => easing,
  cubic: (t: number) => t,
};
export const Linking = { openURL: async (_url: string) => true };
export const useColorScheme = () => "light";

type StateListener = (state: string) => void;
const appStateListeners = new Set<StateListener>();
export const AppState = {
  currentState: "active",
  addEventListener(_type: "change", listener: StateListener) {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
};
/** Test helper: simulate the app moving to the foreground or background. */
export function emitAppState(state: string) {
  for (const listener of appStateListeners) listener(state);
}
export type NativeEventSubscription = { remove(): void };
export type ViewStyle = Record<string, unknown>;
