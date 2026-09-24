import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCrew, useLabour, useUpdateCrew } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, radius, spacing, tabBarClearance, softShadow } from "@/lib/theme";

function memberIdsFromCrew(members: unknown): string[] {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (!m || typeof m !== "object") return "";
      const row = m as Record<string, unknown>;
      return String(row.labourId || row.workerId || "");
    })
    .filter(Boolean);
}

export default function EditCrew() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: crew, isLoading, isError, error, refetch } = useCrew(id);
  const labour = useLabour();
  const update = useUpdateCrew();
  const workers = labour.data?.items ?? [];

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!crew || loaded) return;
    setName(String(crew.name || ""));
    setSelected(memberIdsFromCrew(crew.members));
    setLoaded(true);
  }, [crew, loaded]);

  const selectedCount = useMemo(() => selected.length, [selected]);

  function toggle(workerId: string) {
    setSelected((prev) => (prev.includes(workerId) ? prev.filter((x) => x !== workerId) : [...prev, workerId]));
  }

  async function submit() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Crew name required" });
      return;
    }
    try {
      await update.mutateAsync({
        id: String(id),
        body: {
          name: name.trim(),
          members: selected.map((labourId) => ({ labourId })),
          dailyCost: null,
        },
      });
      Toast.show({ type: "success", text1: "Crew updated" });
      router.replace("/(tabs)/labour" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Edit crew" subtitle="Name + labour roster" onBack={() => router.back()} />
          {isLoading ? <ActivityIndicator color={p.clay} /> : null}
          {isError ? (
            <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
          ) : null}
          {crew ? (
            <>
              <Text style={styles.label}>Crew name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
              <Text style={styles.label}>Labour members</Text>
              <Text style={styles.hint}>Tap to link/unlink workers. Day rates live on each worker record.</Text>
              {workers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No workers yet</Text>
                  <Pressable style={styles.secondaryBtn} onPress={() => router.push("/(tabs)/labour/new" as never)}>
                    <Text style={styles.secondaryBtnText}>Add worker →</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.chips}>
                  {workers.map((w) => {
                    const wid = String(w.id);
                    const on = selected.includes(wid);
                    return (
                      <Pressable key={wid} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(wid)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {String(w.name || w.id)}
                          {w.dailyRate ? ` · ₹${w.dailyRate}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={styles.selected}>{selectedCount} on roster</Text>
              <Pressable style={[styles.btn, update.isPending && { opacity: 0.6 }]} onPress={submit} disabled={update.isPending}>
                {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 6, lineHeight: 18 },
  selected: { color: p.clayDark, fontWeight: "700", marginTop: 8 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  emptyBox: {
    backgroundColor: p.peach,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: 4,
  },
  emptyTitle: { color: p.text, fontWeight: "800", marginBottom: 4 },
  secondaryBtn: { marginTop: 8 },
  secondaryBtnText: { color: p.clay, fontWeight: "700" },
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
  btn: {
    marginTop: spacing.lg,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    ...softShadow,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
