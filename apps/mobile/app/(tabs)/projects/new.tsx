import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateProjectFromQuote, useQuotes } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewProject() {
  const { quoteId: quoteParam, estimateId } = useLocalSearchParams<{ quoteId?: string; estimateId?: string }>();
  const router = useRouter();
  const { data } = useQuotes();
  const create = useCreateProjectFromQuote();
  const accepted = useMemo(() => (data?.items ?? []).filter((q) => String(q.status) === "accepted"), [data]);
  const [quoteId, setQuoteId] = useState(quoteParam || "");

  useEffect(() => {
    if (quoteParam) setQuoteId(quoteParam);
  }, [quoteParam]);

  useEffect(() => {
    if (!quoteId && accepted[0]?.id) setQuoteId(String(accepted[0].id));
  }, [accepted, quoteId]);

  async function submit() {
    if (!quoteId) {
      Toast.show({ type: "error", text1: "Select an approved estimate" });
      return;
    }
    try {
      const proj = await create.mutateAsync({ quoteId });
      Toast.show({ type: "success", text1: "Project started" });
      router.replace(`/(tabs)/projects/${proj.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Start project"
          subtitle="Name is generated from customer and site. Schedule dates are set separately."
          onBack={() => router.back()}
        />
        {quoteParam ? (
          <Text style={{ color: p.muted, marginBottom: 8 }}>
            Using approved estimate{estimateId ? ` · ${estimateId}` : ""}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Accepted quote</Text>
            <View style={styles.chips}>
              {accepted.map((q) => (
                <Pressable key={q.id} style={[styles.chip, quoteId === q.id && styles.chipOn]} onPress={() => setQuoteId(q.id)}>
                  <Text style={[styles.chipText, quoteId === q.id && styles.chipTextOn]}>{String(q.number || q.id)}</Text>
                </Pressable>
              ))}
            </View>
            {accepted.length === 0 ? <Text style={{ color: p.muted }}>Approve an estimate first.</Text> : null}
          </>
        )}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
