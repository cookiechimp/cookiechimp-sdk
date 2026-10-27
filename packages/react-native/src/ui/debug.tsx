import { type ReactNode, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CookieChimp, store } from "../api";
import { useCookieChimp, useDebugEvents } from "../hooks";
import { regionKey } from "../region";
import type { Insets } from "./look";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const INK = "#e8eaed";
const MUTED = "#9aa0a6";
const ON = "#81c995";
const OFF = "#f28b82";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const state = (enabled: boolean | undefined) => (
  <Text style={{ color: enabled ? ON : OFF }}>{enabled ? "on" : "off"}</Text>
);

const time = (at: number) => {
  const date = new Date(at);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

/**
 * A developer panel for consent state, config, vendors, queued records and
 * recent SDK activity, with buttons to show the banner, accept, reject and
 * reset. The provider renders it when `debug` is on. It opens from a small
 * "CookieChimp" tab at the edge of the screen; never ship it in release builds.
 */
export function DebugPanel({ insets = {} }: { insets?: Insets }) {
  const snapshot = useCookieChimp();
  const events = useDebugEvents();
  const [open, setOpen] = useState(false);
  const engine = store.engine();
  const { dashboard, consent } = snapshot;
  const vendors = Object.entries(CookieChimp.getVendors());
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open CookieChimp debug panel"
        testID="cookiechimp-debug-tab"
        onPress={() => setOpen(true)}
        style={[
          styles.tab,
          { top: (insets.top ?? 0) + 8, right: (insets.right ?? 0) + 8 },
        ]}
      >
        <Text style={styles.tabText}>CC debug</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View
          testID="cookiechimp-debug-panel"
          style={[
            styles.panel,
            {
              paddingTop: (insets.top ?? 0) + 12,
              paddingBottom: (insets.bottom ?? 0) + 12,
              paddingLeft: (insets.left ?? 0) + 16,
              paddingRight: (insets.right ?? 0) + 16,
            },
          ]}
        >
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.title}>
              CookieChimp debug
            </Text>
            <Action label="Close" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.actions}>
              <Action
                label="Show banner"
                onPress={() => {
                  setOpen(false);
                  CookieChimp.show();
                }}
              />
              <Action
                label="Show preferences"
                onPress={() => {
                  setOpen(false);
                  CookieChimp.showPreferences();
                }}
              />
              <Action label="Accept all" onPress={() => engine?.acceptAll()} />
              <Action label="Reject all" onPress={() => engine?.rejectAll()} />
              <Action label="Reset consent" onPress={CookieChimp.reset} />
              <Action label="Send records" onPress={CookieChimp.flush} />
            </View>
            <Section title="SDK">
              <Row label="Status" value={snapshot.status} />
              {snapshot.error ? (
                <Row label="Error" value={snapshot.error} />
              ) : null}
              <Row label="Config" value={snapshot.source ?? "none"} />
              <Row label="Version" value={dashboard?.configVersion ?? "none"} />
              <Row label="Account" value={dashboard?.accountId ?? "none"} />
              <Row label="Banner" value={dashboard?.bannerId ?? "none"} />
              <Row
                label="Language"
                value={`${snapshot.language || "none"} (locale ${snapshot.locale}, SDK copy ${snapshot.text?.messages.language ?? "en"})`}
              />
              <Row
                label="Region"
                value={regionKey(snapshot.region) || "unknown"}
              />
              <Row label="Regulation" value={snapshot.regulation ?? "none"} />
              <Row label="Records waiting" value={engine?.pending() ?? 0} />
            </Section>
            <Section title="Consent">
              <Row label="Decided" value={String(snapshot.decided)} />
              <Row label="Action" value={consent?.action ?? "none"} />
              <Row label="Consent ID" value={consent?.consentId ?? "none"} />
              <Row label="Time" value={consent?.ts ?? "none"} />
              {(dashboard?.preferences ?? []).map((category) => (
                <View key={category.slug}>
                  <Row
                    label={category.slug}
                    value={state(
                      category.required ||
                        consent?.categories[category.slug] === true,
                    )}
                  />
                  {category.services.map((service) => (
                    <Row
                      key={service.consent_key}
                      label={`  ${service.consent_key}`}
                      value={state(
                        category.required ||
                          consent?.services?.[service.consent_key] === true,
                      )}
                    />
                  ))}
                </View>
              ))}
            </Section>
            <Section title="Registered vendors">
              {vendors.length ? (
                vendors.map(([name, info]) => (
                  <Row
                    key={name}
                    label={`${name} (${info.category})`}
                    value={state(info.running)}
                  />
                ))
              ) : (
                <Text style={styles.label}>None registered.</Text>
              )}
            </Section>
            <Section title="Activity">
              {events.map((event) => (
                <Text
                  key={`${event.at}-${event.message}`}
                  style={[
                    styles.event,
                    event.kind === "error" && { color: OFF },
                  ]}
                >
                  {time(event.at)} {event.kind} {event.message}
                </Text>
              ))}
            </Section>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: "absolute",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(32,33,36,0.88)",
  },
  tabText: { color: INK, fontSize: 11, fontWeight: "700" },
  panel: { flex: 1, backgroundColor: "#202124" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  title: { color: INK, fontSize: 18, fontWeight: "700" },
  body: { gap: 16, paddingBottom: 24 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#3c4043",
  },
  actionText: { color: INK, fontSize: 13, fontWeight: "600" },
  section: { gap: 4 },
  sectionTitle: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { color: MUTED, fontSize: 12, fontFamily: MONO, flexShrink: 1 },
  value: {
    color: INK,
    fontSize: 12,
    fontFamily: MONO,
    flexShrink: 1,
    textAlign: "right",
  },
  event: { color: INK, fontSize: 11, lineHeight: 16, fontFamily: MONO },
});
