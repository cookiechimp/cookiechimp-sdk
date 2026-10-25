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
});

export const View = ({ children, ...props }: Props) => (
  <div {...aria(props)}>{children}</div>
);
export const ScrollView = View;
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
};
export const Platform = { OS: "ios" as "ios" | "android" };
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
