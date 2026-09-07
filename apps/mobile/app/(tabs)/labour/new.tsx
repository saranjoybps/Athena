import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateLabour } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewLabour() {
  const router = useRouter();
  const create = useCreateLabour();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("painter");
  const [dailyRate, setDailyRate] = useState("");

  async function submit() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Name required" });
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), phone: phone || null, trade: trade || null, dailyRate: dailyRate || null });
      Toast.show({ type: "success", text1: "Worker added" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New worker" onBack={() => router.back()} />
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Trade</Text>
        <TextInput style={styles.input} value={trade} onChangeText={setTrade} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Daily rate</Text>
        <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
