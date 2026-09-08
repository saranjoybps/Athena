import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { completeOnboarding } from "@/lib/auth";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

const TRADES = ["Painting", "Plumbing", "Electrical", "Interior", "Renovation", "Waterproofing"];

export default function OnboardingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user?.email?.split("@")[0] || "");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [address, setAddress] = useState("");
  const [selected, setSelected] = useState<string[]>(["Painting"]);

  async function finish() {
    if (!businessName.trim() || !phone.trim() || !city.trim() || !address.trim()) {
      Toast.show({ type: "error", text1: "Fill business, phone, city, and address" });
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding({
        account: { name: name || "Owner", email: user?.email || null, phone },
        business: {
          businessName: businessName.trim(),
          ownerName: name || "Owner",
          phone,
          email: user?.email || "",
        },
        location: {
          state: "Tamil Nadu",
          city,
          pinCode: pinCode || "600001",
          address,
        },
        config: { gstRegistered: false },
        trades: selected.map((t) => t.toLowerCase()),
        team: [],
      });
      Toast.show({ type: "success", text1: "Business created" });
      router.replace("/(tabs)");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Onboarding failed",
        text2: (e as { userMessage?: string })?.userMessage || (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>Step {step} of 3</Text>
        <Text style={styles.title}>Set up your business</Text>
        {step === 1 ? (
          <>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={p.faint} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={p.faint} />
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Business name" placeholderTextColor={p.faint} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={p.faint} />
            <TextInput style={styles.input} value={pinCode} onChangeText={setPinCode} placeholder="PIN code" keyboardType="number-pad" placeholderTextColor={p.faint} />
            <TextInput style={[styles.input, { minHeight: 80 }]} value={address} onChangeText={setAddress} placeholder="Address" multiline placeholderTextColor={p.faint} />
          </>
        ) : null}
        {step === 3 ? (
          <View style={styles.chips}>
            {TRADES.map((t) => {
              const on = selected.includes(t);
              return (
                <Pressable
                  key={t}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setSelected((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.row}>
          {step > 1 ? (
            <Pressable style={styles.secondary} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
          ) : null}
          {step < 3 ? (
            <Pressable style={styles.primary} onPress={() => setStep((s) => s + 1)}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.primary, busy && { opacity: 0.7 }]} onPress={finish} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Finish</Text>}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  step: { color: p.clay, fontWeight: "700", marginBottom: 4 },
  title: { ...typography.h1, color: p.text, fontSize: 24, marginBottom: spacing.lg },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontWeight: "600" },
  chipTextOn: { color: p.clayDark },
  row: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  primary: { flex: 1, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { flex: 1, borderWidth: 1, borderColor: p.border, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", backgroundColor: p.surface },
  secondaryText: { color: p.text, fontWeight: "700" },
});
