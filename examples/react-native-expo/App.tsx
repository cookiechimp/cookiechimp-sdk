import {
  CookieChimp,
  CookieChimpProvider,
  connectFirebase,
  type FirebaseAnalyticsLike,
  type FirebaseCrashlyticsLike,
  presets,
  requestTrackingAfterConsent,
  richText,
  useCategories,
  useConsentDraft,
  useConsentText,
  useCookieChimp,
} from "@cookiechimp/react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
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

// Stand-ins for vendor SDKs so the example runs in Expo Go. In a real app,
// pass the SDKs themselves, for example `analytics()` from
// @react-native-firebase/analytics or a Mixpanel instance.
const show = (value: unknown) =>
  typeof value === "function" ? "callback" : JSON.stringify(value);
const fake = <T extends object>(name: string) =>
  new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args: unknown[]) =>
          record(`${name}.${String(method)}(${args.map(show).join(", ")})`),
    },
  ) as T;

// Register vendors before the SDK starts. The sample config's analytics
// category has Google Analytics; the presets use the names from CookieChimp's
// mobile SDK library and fall back to their category.
CookieChimp.registerVendor("Google Analytics", "analytics", {
  onStart: () => record("Google Analytics started"),
  onStop: () => record("Google Analytics stopped"),
});
CookieChimp.registerVendor(presets.mixpanel(fake("mixpanel")));
CookieChimp.registerVendor(presets.appsFlyer(fake("appsFlyer")));
connectFirebase({
  analytics: fake<FirebaseAnalyticsLike>("analytics()"),
  crashlytics: fake<FirebaseCrashlyticsLike>("crashlytics()"),
});
// With expo-tracking-transparency, pass `requestTrackingPermissionsAsync`.
requestTrackingAfterConsent({
  request: async () => {
    record("App Tracking Transparency prompt (simulated)");
    return { status: "granted" };
  },
  onStatus: (status) => record(`tracking status: ${status}`),
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

function Status() {
  const state = useCookieChimp();
  const categories = useCategories();
  return (
    <View style={styles.section}>
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
      {categories.map((category) => (
        <Text key={category.id}>
          {category.label}: {category.enabled ? "allowed" : "denied"}
        </Text>
      ))}
    </View>
  );
}

/** Dashboard rich text as React Native text, for the custom screens. */
function Rich({ value }: { value?: string }) {
  return (
    <>
      {richText(value).map((paragraph, index) => (
        <Text key={String(index)}>
          {paragraph.map((span, at) => (
            <Text
              key={String(at)}
              style={span.bold ? styles.bold : undefined}
              onPress={
                span.href ? () => record(`open ${span.href}`) : undefined
              }
            >
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </>
  );
}

/** Headless mode: the app's own banner and preferences, built from hooks. */
function CustomConsent() {
  const { bannerOpen, preferencesOpen } = useCookieChimp();
  const text = useConsentText();
  const draft = useConsentDraft();
  if (!text) return null;
  if (preferencesOpen)
    return (
      <View style={styles.custom}>
        <Text style={styles.subtitle}>{text.preferences.title}</Text>
        <Rich value={text.preferences.description} />
        {draft.categories.map((category) => (
          <View key={category.id} style={styles.category}>
            <View style={styles.row}>
              <Text style={styles.bold}>{category.label}</Text>
              <Switch
                accessibilityLabel={category.label}
                value={category.enabled}
                disabled={category.required}
                onValueChange={(on) => draft.toggleCategory(category.id, on)}
              />
            </View>
            {category.services.map((service) => (
              <View key={service.id} style={styles.row}>
                <Text>{service.name}</Text>
                <Switch
                  accessibilityLabel={service.name}
                  value={service.enabled}
                  disabled={category.required}
                  onValueChange={(on) => draft.toggleService(service.id, on)}
                />
              </View>
            ))}
          </View>
        ))}
        <Button title={text.preferences.save} onPress={draft.save} />
        <Button
          title={text.preferences.close}
          onPress={CookieChimp.hidePreferences}
        />
      </View>
    );
  if (!bannerOpen) return null;
  return (
    <View style={styles.custom}>
      <Text style={styles.subtitle}>{text.banner.title}</Text>
      <Rich value={text.banner.description} />
      <Button
        title={text.banner.acceptAll}
        onPress={() => CookieChimp.acceptCategory("all")}
      />
      <Button
        title={text.banner.rejectAll}
        onPress={() => CookieChimp.acceptCategory([])}
      />
      <Button
        title={text.banner.customize}
        onPress={CookieChimp.showPreferences}
      />
    </View>
  );
}

const LANGUAGES = [undefined, "de", "fr", "ja"] as const;

function Home({
  headless,
  setHeadless,
  language,
  setLanguage,
}: {
  headless: boolean;
  setHeadless(value: boolean): void;
  language: (typeof LANGUAGES)[number];
  setLanguage(value: (typeof LANGUAGES)[number]): void;
}) {
  const lines = useLog();
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>CookieChimp React Native</Text>
        <Status />
        <View style={styles.row}>
          <Text>Custom UI (headless mode)</Text>
          <Switch value={headless} onValueChange={setHeadless} />
        </View>
        <View style={styles.row}>
          <Text>Language</Text>
          {LANGUAGES.map((code) => (
            <Pressable
              key={code ?? "device"}
              accessibilityRole="button"
              onPress={() => setLanguage(code)}
            >
              <Text style={code === language ? styles.bold : undefined}>
                {code ?? "device"}
              </Text>
            </Pressable>
          ))}
        </View>
        {headless && <CustomConsent />}
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
  const [headless, setHeadless] = useState(false);
  const [language, setLanguage] =
    useState<(typeof LANGUAGES)[number]>(undefined);
  return (
    <CookieChimpProvider
      {...(accountId ? { accountId } : { config: bundledConfig })}
      language={language}
      insets={insets}
      ui={!headless}
      // The debug panel tab shows in development builds only.
      debug={__DEV__}
      onFirstConsent={(preferences) =>
        record(`first consent: ${preferences.acceptType}`)
      }
      onChange={(_, categories) =>
        record(`changed: ${categories.join(", ") || "services only"}`)
      }
    >
      <Home
        headless={headless}
        setHeadless={setHeadless}
        language={language}
        setLanguage={setLanguage}
      />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  custom: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  category: { gap: 4, paddingVertical: 6 },
  bold: { fontWeight: "700" },
  log: { fontFamily: "Courier", fontSize: 12 },
});
