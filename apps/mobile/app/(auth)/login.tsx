import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { signInDev } from "@/lib/auth";
import { getApiBaseUrl, getDefaultApiUrl } from "@/lib/config";
import { useSettingsStore } from "@/store/settings";
import { lightPalette as p, radius, spacing, typography, cardShadow } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const override = useSettingsStore((s) => s.apiUrlOverride);
  const setOverride = useSettingsStore((s) => s.setApiUrlOverride);
  const [apiUrl, setApiUrl] = useState(override || getDefaultApiUrl());

  async function enter() {
    setLoading(true);
    try {
      await signInDev(process.env.EXPO_PUBLIC_DEMO_USER_ID || "local-owner");
      router.replace("/(tabs)");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Sign-in failed",
        text2: (e as { userMessage?: string })?.userMessage || `API: ${getApiBaseUrl()}`,
      });
      setShowApi(true);
    } finally {
      setLoading(false);
    }
  }

  function saveApi() {
    const cleaned = apiUrl.trim().replace(/\/$/, "");
    if (!cleaned.startsWith("http")) {
      Toast.show({ type: "error", text1: "URL must start with http:// or https://" });
      return;
    }
    setOverride(cleaned === getDefaultApiUrl() ? null : cleaned);
    Toast.show({ type: "success", text1: "API URL saved" });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>Athena</Text>
        <Text style={styles.subtitle}>Mobile-first app for contractors in the field</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Demo account</Text>
          <Text style={styles.line}>Business: Athena Demo Contractors</Text>
          <Text style={styles.line}>User: Demo Owner</Text>
          <Text style={styles.line}>ID: local-owner</Text>
          <Text style={styles.api}>API {override || getDefaultApiUrl()}</Text>
        </View>

        <Pressable style={[styles.btn, loading && { opacity: 0.7 }]} onPress={enter} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue as demo owner</Text>}
        </Pressable>

        <Pressable style={styles.link} onPress={() => setShowApi((v) => !v)}>
          <Text style={styles.linkText}>{showApi ? "Hide API setup" : "Phone / APK: set API server"}</Text>
        </Pressable>

        {showApi ? (
          <View style={styles.apiBox}>
            <Text style={styles.hint}>Use your computer's LAN IP (not localhost) on a real phone.</Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.10:8080/api/v1"
              placeholderTextColor={p.faint}
            />
            <Pressable style={styles.btnSecondary} onPress={saveApi}>
              <Text style={styles.btnSecondaryText}>Save API URL</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  brand: { ...typography.h1, color: p.clay },
  subtitle: { color: p.muted, marginTop: 8, marginBottom: spacing.lg },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  cardTitle: { ...typography.h3, color: p.text, marginBottom: 8 },
  line: { color: p.muted, marginTop: 4, fontSize: 14 },
  api: { color: p.faint, marginTop: 12, fontSize: 12 },
  btn: {
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { marginTop: spacing.md, alignItems: "center", padding: 12 },
  linkText: { color: p.clay, fontWeight: "600" },
  apiBox: { marginTop: 4, gap: 10 },
  hint: { color: p.muted, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: p.text,
  },
  btnSecondary: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: p.clay,
  },
  btnSecondaryText: { color: p.clay, fontWeight: "700" },
});
