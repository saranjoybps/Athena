import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import Toast from "react-native-toast-message";
import { getApiBaseUrl, getDefaultApiUrl } from "@/lib/config";
import { useSettingsStore } from "@/store/settings";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, typography, tabBarClearance } from "@/lib/theme";
import apiClient from "@/lib/api";

export default function SettingsScreen() {
  const router = useRouter();
  const override = useSettingsStore((s) => s.apiUrlOverride);
  const setOverride = useSettingsStore((s) => s.setApiUrlOverride);
  const [url, setUrl] = useState(override || getDefaultApiUrl());
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setUrl(override || getDefaultApiUrl());
  }, [override]);

  async function save() {
    const cleaned = url.trim().replace(/\/$/, "");
    if (!cleaned.startsWith("http")) {
      Toast.show({ type: "error", text1: "URL must start with http:// or https://" });
      return;
    }
    setOverride(cleaned === getDefaultApiUrl() ? null : cleaned);
    Toast.show({ type: "success", text1: "API URL saved", text2: "Used for all requests" });
  }

  async function test() {
    setTesting(true);
    try {
      const cleaned = url.trim().replace(/\/$/, "");
      await apiClient.get("/me", { baseURL: cleaned });
      Toast.show({ type: "success", text1: "Connected", text2: cleaned });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Cannot reach API",
        text2: (e as { userMessage?: string })?.userMessage || "Check Wi‑Fi / LAN IP",
      });
    } finally {
      setTesting(false);
    }
  }

  function reset() {
    setOverride(null);
    setUrl(getDefaultApiUrl());
    Toast.show({ type: "success", text1: "Reset to build default" });
  }

  const version = Constants.expoConfig?.version ?? "0.2.0";
  const versionCode = Constants.expoConfig?.android?.versionCode;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="API & device" subtitle="Field device setup" onBack={() => router.back()} />

        <Text style={styles.section}>API server</Text>
        <Text style={styles.hint}>
          On a phone APK, localhost won't work. Use your machine LAN IP, e.g. http://192.168.1.10:8080/api/v1
        </Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.x.x:8080/api/v1"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.meta}>Active: {getApiBaseUrl()}</Text>
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={save}>
            <Text style={styles.btnText}>Save URL</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={test} disabled={testing}>
            {testing ? <ActivityIndicator color={p.clay} /> : <Text style={styles.btnSecondaryText}>Test</Text>}
          </Pressable>
        </View>
        <Pressable style={styles.reset} onPress={reset}>
          <Text style={styles.resetText}>Reset to default</Text>
        </Pressable>

        <Text style={styles.section}>App</Text>
        <View style={styles.card}>
          <Text style={styles.line}>Athena {version}{versionCode ? ` (${versionCode})` : ""}</Text>
          <Text style={styles.line}>Package io.athena.app</Text>
          <Text style={styles.line}>Portrait · Android APK ready via EAS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: 8,
  },
  hint: { color: p.muted, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: p.text,
    fontSize: 14,
  },
  meta: { color: p.faint, fontSize: 12, marginTop: 8, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnSecondary: {
    minWidth: 88,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
  },
  btnSecondaryText: { color: p.clay, fontWeight: "700" },
  reset: { marginTop: 12, alignItems: "center", padding: 8 },
  resetText: { color: p.muted, fontWeight: "600" },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  line: { color: p.text, marginTop: 4, ...typography.body },
});
