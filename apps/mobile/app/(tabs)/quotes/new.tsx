import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateQuote, useEstimates } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewQuote() {
  const router = useRouter();
  const { data } = useEstimates();
  const create = useCreateQuote();
  const estimates = data?.items ?? [];
  const [estimateId, setEstimateId] = useState("");
  const [validityDays, setValidityDays] = useState("15");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!estimateId && estimates[0]?.id) setEstimateId(String(estimates[0].id));
  }, [estimates, estimateId]);

  async function submit() {
    try {
      const q = await create.mutateAsync({
        estimateId,
        validityDays: Number(validityDays || 15),
        notes: notes || undefined,
      });
      Toast.show({ type: "success", text1: "Quote created" });
      router.replace(`/(tabs)/quotes/${q.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New quote" subtitle="From an estimate" onBack={() => router.back()} />
        <Text style={styles.label}>Estimate</Text>
        <View style={styles.chips}>
          {estimates.map((e) => (
            <Pressable key={e.id} style={[styles.chip, estimateId === e.id && styles.chipOn]} onPress={() => setEstimateId(e.id)}>
              <Text style={[styles.chipText, estimateId === e.id && styles.chipTextOn]} numberOfLines={1}>
                {String(e.title || e.number || e.id)}
              </Text>
            </Pressable>
          ))}
        </View>
        {estimates.length === 0 ? <Text style={{ color: p.muted }}>No estimates yet — create one on web first.</Text> : null}
        <Text style={styles.label}>Validity (days)</Text>
        <TextInput style={styles.input} value={validityDays} onChangeText={setValidityDays} keyboardType="number-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending || !estimateId}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create quote</Text>}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface, maxWidth: "100%" },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
