import { type ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

const EASE_OUT = Easing.out(Easing.cubic);

/** True while the user asked the system to reduce motion. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo?.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) setReduce(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo?.addEventListener?.(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return reduce;
}

/** 0 to 1 progress that follows `on`, for expand and toggle animations. */
export function useProgress(on: boolean, duration = 240) {
  const progress = useRef(new Animated.Value(on ? 1 : 0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    Animated.timing(progress, {
      toValue: on ? 1 : 0,
      duration: reduce ? 0 : duration,
      easing: EASE_OUT,
      useNativeDriver: false,
    }).start();
  }, [on, progress, duration, reduce]);
  return progress;
}

/**
 * Keeps an overlay mounted while it animates out. `progress` runs from 0
 * (hidden) to 1 (shown) on the native driver.
 */
export function usePresence(visible: boolean, duration = 280) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduce ? 0 : visible ? duration : duration * 0.7,
      easing: visible ? EASE_OUT : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress, duration, reduce]);
  return { mounted: mounted || visible, progress };
}

/** Animates its height between collapsed and the measured content height. */
export function Collapse({
  open,
  progress,
  children,
}: {
  open: boolean;
  progress: Animated.Value;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(0);
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={{
        overflow: "hidden",
        opacity: progress,
        height: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, height],
        }),
      }}
    >
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}
