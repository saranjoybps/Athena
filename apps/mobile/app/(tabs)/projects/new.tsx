import { useEffect, useMemo, useRef, useState } from "react";
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
  const autoStarted = useRef(false);

  useEffect(() => {
    if (quoteParam) setQuoteId(quoteParam);
  }, [quoteParam]);

  useEffect(() => {
    if (!quoteId && accepted[0]?.id) setQuoteId(String(accepted[0].id));
  }, [accepted, quoteId]);

  async function submit(qid: string) {
    try {
      const proj = await create.mutateAsync({ quoteId: qid });
      Toast.show({ type: "success", text1: "Project started" });
      router.replace(`/(tabs)/projects/${proj.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  // Deep-link from estimate: create once — no second "Create project" tap.
  useEffect(() => {
    if (!quoteParam || !quoteId || autoStarted.current || create.isPending) return;
    autoStarted.current = true;
    void submit(quoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteParam, quoteId]);

  if (quoteParam) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.content}>
          <ScreenHeader title="Start project" onBack={() => router.back()} />
          <View style={styles.autoBox}>
            <ActivityIndicator color={p.clay} />
            <Text style={styles.autoText}>
              Starting project from approved estimate{estimateId ? `…` : "…"}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Start project"
          subtitle="Pick an approved estimate. Name is generated from customer and site."
          onBack={() => router.back()}
        />
        <Text style={styles.label}>Accepted estimate</Text>
        <View style={styles.chips}>
          {accepted.map((q) => (
            <Pressable key={q.id} style={[styles.chip, quoteId === q.id && styles.chipOn]} onPress={() => setQuoteId(q.id)}>
              <Text style={[styles.chipText, quoteId === q.id && styles.chipTextOn]}>{String(q.number || q.id)}</Text>
            </Pressable>
          ))}
        </View>
        {accepted.length === 0 ? <Text style={{ color: p.muted }}>Approve an estimate first.</Text> : null}
        <Pressable style={styles.btn} onPress={() => quoteId && submit(quoteId)} disabled={create.isPending || !quoteId}>
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
  autoBox: { marginTop: spacing.xl, alignItems: "center", gap: 12 },
  autoText: { color: p.muted, textAlign: "center" },
});
