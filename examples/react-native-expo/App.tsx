import {
  CookieChimp,
  CookieChimpProvider,
  useCategories,
  useCookieChimp,
} from "@cookiechimp/react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import bundledConfig from "./cookiechimp-config.json";

// Set EXPO_PUBLIC_COOKIECHIMP_ACCOUNT_ID to load your live dashboard config.
// Without it, the example runs in offline mode from the bundled sample config.
const accountId = process.env.EXPO_PUBLIC_COOKIECHIMP_ACCOUNT_ID;

const log: string[] = [];
const listeners = new Set<() => void>();
const record = (line: string) => {
  log.unshift(`${new Date().toLocaleTimeString()} ${line}`);
  for (const listener of listeners) listener();
};

// Register vendors before the SDK starts. In a real app these callbacks
// enable and disable the vendor SDK's data collection.
CookieChimp.registerVendor("Google Analytics", "analytics", {
  onStart: () => record("Google Analytics started"),
  onStop: () => record("Google Analytics stopped"),
});
CookieChimp.registerVendor("Meta Pixel", "marketing", {
  onStart: () => record("Meta Pixel started"),
  onStop: () => record("Meta Pixel stopped"),
});

function useLog() {
  const [, render] = useState(0);
  useEffect(() => {
    const listener = () => render((count) => count + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return log;
}

function Home() {
  const state = useCookieChimp();
  const categories = useCategories();
  const lines = useLog();
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>CookieChimp React Native</Text>
        <Text>
          Mode: {accountId ? `connected (${accountId})` : "offline sample"}
        </Text>
        <Text>Status: {state.status}</Text>
        {state.error ? <Text>Error: {state.error}</Text> : null}
        <Text>
          Banner: {state.dashboard?.bannerId ?? "none"} · regulation:{" "}
          {state.regulation ?? "none"} · language: {state.language}
        </Text>
        <Text>Decided: {String(state.decided)}</Text>
        <Text>Consent ID: {state.consent?.consentId ?? "none"}</Text>
        <View style={styles.section}>
          {categories.map((category) => (
            <Text key={category.id}>
              {category.label}: {category.enabled ? "allowed" : "denied"}
            </Text>
          ))}
        </View>
        <View style={styles.buttons}>
          <Button title="Show banner" onPress={CookieChimp.show} />
          <Button
            title="Privacy preferences"
            onPress={CookieChimp.showPreferences}
          />
          <Button title="Reset consent" onPress={CookieChimp.reset} />
        </View>
        <Text style={styles.subtitle}>Vendor log</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.log}>
            {line}
          </Text>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  return (
    <CookieChimpProvider
      {...(accountId ? { accountId } : { config: bundledConfig })}
      insets={insets}
      debug={__DEV__}
      onFirstConsent={(preferences) =>
        record(`first consent: ${preferences.acceptType}`)
      }
      onChange={(_, categories) =>
        record(`changed: ${categories.join(", ") || "services only"}`)
      }
    >
      <Home />
    </CookieChimpProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 17, fontWeight: "600", marginTop: 12 },
  section: { marginTop: 8, gap: 4 },
  buttons: { gap: 8, marginTop: 12 },
  log: { fontFamily: "Courier", fontSize: 12 },
});
