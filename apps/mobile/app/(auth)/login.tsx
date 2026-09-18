import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>Athena</Text>
        <Text style={styles.subtitle}>
          Sign in with email. New accounts continue to business setup for a 15-day trial.
        </Text>

        <View style={styles.modeRow}>
          <Pressable style={[styles.modeBtn, mode === "signin" && styles.modeOn]} onPress={() => setMode("signin")}>
            <Text style={[styles.modeText, mode === "signin" && styles.modeTextOn]}>Sign in</Text>
          </Pressable>
          <Pressable style={[styles.modeBtn, mode === "signup" && styles.modeOn]} onPress={() => setMode("signup")}>
            <Text style={[styles.modeText, mode === "signup" && styles.modeTextOn]}>Start trial</Text>
          </Pressable>
        </View>

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

        <Pressable style={[styles.btn, loading && { opacity: 0.7 }]} onPress={enter} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{mode === "signup" ? "Continue to business setup" : "Sign in"}</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>Google sign-in is available on the web app.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  brand: { ...typography.h1, color: p.clay },
  subtitle: { color: p.muted, marginTop: 8, marginBottom: spacing.lg },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    alignItems: "center",
  },
  modeOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  modeText: { color: p.muted, fontWeight: "600" },
  modeTextOn: { color: p.clayDark },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: p.text,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
    marginTop: 6,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: p.faint, fontSize: 12, marginTop: 12, textAlign: "center" },
});
