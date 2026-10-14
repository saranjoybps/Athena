import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { sendPasswordReset, signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { lightPalette as p, radius, spacing, typography, softShadow } from "@/lib/theme";

const AUTH_MESSAGES: Record<string, string> = {
  "auth/network-request-failed": "Can't reach the sign-in service. Check your internet connection and try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Enter your password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/email-already-in-use": "An account already exists with this email.",
  "auth/weak-password": "Use a password with at least 6 characters.",
};

function authErrorMessage(e: unknown): string {
  const err = e as { code?: string; userMessage?: string; message?: string };
  if (err?.code && AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code];
  return err?.userMessage || "Something went wrong. Please try again.";
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

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
        text2: authErrorMessage(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setResetting(true);
    try {
      await sendPasswordReset(email);
      Toast.show({
        type: "success",
        text1: "Reset email sent",
        text2: "Check your inbox for a password reset link",
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Could not send reset email",
        text2: authErrorMessage(e),
      });
    } finally {
      setResetting(false);
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
              {mode === "signin" ? (
                <Pressable style={styles.forgot} onPress={forgotPassword} disabled={resetting}>
                  <Text style={styles.forgotText}>{resetting ? "Sending…" : "Forgot password?"}</Text>
                </Pressable>
              ) : null}
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
  forgot: { alignItems: "center", paddingTop: 4, paddingBottom: 2 },
  forgotText: { color: p.clay, fontWeight: "700", fontSize: 14 },
});
