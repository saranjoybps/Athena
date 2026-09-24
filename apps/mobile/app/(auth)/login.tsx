import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { lightPalette as p, radius, spacing, typography, softShadow } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function enter() {
    setLoading(true);
    try {
      const session =
        mode === "signup"
          ? await signUpWithEmail(name, email, password)
          : await signInWithEmail(email, password);
      router.replace(session.orgId ? "/(tabs)" : "/(auth)/onboarding");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: mode === "signup" ? "Sign-up failed" : "Sign-in failed",
        text2: (e as { userMessage?: string; message?: string })?.userMessage || (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.heroBlob}>
              <Text style={styles.heroEmoji}>🏗️</Text>
            </View>
            <Text style={styles.brand}>Athena</Text>
            <Text style={styles.subtitle}>
              Site & office in one place — customers, estimates, projects, and collections.
            </Text>

            <View style={styles.modeRow}>
              <Pressable style={[styles.modeBtn, mode === "signin" && styles.modeOn]} onPress={() => setMode("signin")}>
                <Text style={[styles.modeText, mode === "signin" && styles.modeTextOn]}>Sign in</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, mode === "signup" && styles.modeOn]} onPress={() => setMode("signup")}>
                <Text style={[styles.modeText, mode === "signup" && styles.modeTextOn]}>Start trial</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              {mode === "signup" ? (
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={p.faint} />
              ) : null}
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={p.faint}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor={p.faint}
              />
              <PrimaryButton
                label={mode === "signup" ? "Let's start" : "Sign in"}
                showArrow
                loading={loading}
                onPress={enter}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40 },
  heroBlob: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: p.peach,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
    ...softShadow,
  },
  heroEmoji: { fontSize: 52 },
  brand: { ...typography.h1, color: p.text, textAlign: "center", fontSize: 32 },
  subtitle: { color: p.muted, textAlign: "center", marginTop: 10, marginBottom: spacing.lg, lineHeight: 22, paddingHorizontal: 12 },
  modeRow: {
    flexDirection: "row",
    backgroundColor: p.surface,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.full, alignItems: "center" },
  modeOn: { backgroundColor: p.clay },
  modeText: { color: p.muted, fontWeight: "700" },
  modeTextOn: { color: "#fff" },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: p.border,
    gap: 12,
    ...softShadow,
  },
  input: {
    backgroundColor: p.slateSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: p.text,
    fontSize: 15,
  },
});
