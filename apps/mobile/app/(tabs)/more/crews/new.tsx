import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateCrew, useLabour } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function NewCrew() {
  const router = useRouter();
  const create = useCreateCrew();
  const labour = useLabour();
  const workers = labour.data?.items ?? [];
  const [name, setName] = useState("");
  const [dailyCost, setDailyCost] = useState("");
  const [memberId, setMemberId] = useState("");

  async function submit() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Crew name required" });
      return;
    }
    if (!dailyCost.trim()) {
      Toast.show({ type: "error", text1: "Daily wages / cost required" });
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        dailyCost: dailyCost.trim(),
        members: memberId ? [{ workerId: memberId }] : [],
      });
      Toast.show({ type: "success", text1: "Crew created" });
      router.replace("/(tabs)/more/crews" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New crew" onBack={() => router.back()} />
        <Text style={styles.label}>Crew name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Daily wages / cost *</Text>
        <TextInput
          style={styles.input}
          value={dailyCost}
          onChangeText={setDailyCost}
          keyboardType="decimal-pad"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Member (optional)</Text>
        <View style={styles.chips}>
          {workers.map((w) => (
            <Pressable
              key={w.id}
              style={[styles.chip, memberId === w.id && styles.chipOn]}
              onPress={() => setMemberId(memberId === w.id ? "" : String(w.id))}
            >
              <Text style={[styles.chipText, memberId === w.id && styles.chipTextOn]}>{String(w.name || w.id)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
