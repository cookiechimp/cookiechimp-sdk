import type { DashboardConfig } from "@cookiechimp/core/sync";
import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { palette } from "../presentation";

const RTL_FALLBACK = ["ar", "fa", "he", "ur"];

export interface Insets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** Dashboard colors for the current color scheme, and text direction. */
export function useLook(dashboard: DashboardConfig) {
  const scheme = useColorScheme();
  return useMemo(() => {
    const colors = palette(dashboard.theme, scheme);
    const base = dashboard.language.split("-")[0] ?? "";
    const rtl = (dashboard.rtlLanguages ?? RTL_FALLBACK).includes(base);
    return { colors, rtl };
  }, [dashboard, scheme]);
}
