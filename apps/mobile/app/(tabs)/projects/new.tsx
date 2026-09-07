import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateProjectFromQuote, useQuotes } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewProject() {
  const router = useRouter();
  const { data } = useQuotes();
  const create = useCreateProjectFromQuote();
  const accepted = useMemo(() => (data?.items ?? []).filter((q) => String(q.status) === "accepted"), [data]);
  const [quoteId, setQuoteId] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!quoteId && accepted[0]?.id) setQuoteId(String(accepted[0].id));
  }, [accepted, quoteId]);

  async function submit() {
    try {
      const proj = await create.mutateAsync({ quoteId, name: name.trim() || undefined });
      Toast.show({ type: "success", text1: "Project started" });
      router.replace(`/(tabs)/projects/${proj.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Start project" subtitle="From accepted quote" onBack={() => router.back()} />
        <Text style={styles.label}>Accepted quote</Text>
        <View style={styles.chips}>
          {accepted.map((q) => (
            <Pressable key={q.id} style={[styles.chip, quoteId === q.id && styles.chipOn]} onPress={() => setQuoteId(q.id)}>
              <Text style={[styles.chipText, quoteId === q.id && styles.chipTextOn]}>{String(q.number || q.id)}</Text>
            </Pressable>
          ))}
        </View>
        {accepted.length === 0 ? <Text style={{ color: p.muted }}>No accepted quotes yet.</Text> : null}
        <Text style={styles.label}>Project name (optional)</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending || !quoteId}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create project</Text>}
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
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
