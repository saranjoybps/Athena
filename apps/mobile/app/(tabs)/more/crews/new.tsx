import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateCrew, useLabour } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { lightPalette as p, radius, spacing, tabBarClearance, softShadow } from "@/lib/theme";

/** Create crew + tap workers to link them (same roster model as edit crew). */
export default function NewCrew() {
  const router = useRouter();
  const create = useCreateCrew();
  const labour = useLabour();
  const workers = labour.data?.items ?? [];
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Crew name required" });
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        members: selected.map((labourId) => ({ labourId })),
      });
      Toast.show({ type: "success", text1: "Crew created", text2: selected.length ? `${selected.length} workers linked` : undefined });
      router.replace("/(tabs)/labour" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New crew" subtitle="Name + link labour workers" onBack={() => router.back()} />
          {labour.isLoading ? <ActivityIndicator color={p.clay} style={{ marginBottom: 12 }} /> : null}
          <Text style={styles.label}>Crew name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Painting crew A"
            placeholderTextColor={p.faint}
          />
          <Text style={styles.label}>Link labour members</Text>
          <Text style={styles.hint}>Tap workers to add them to this crew. Day rates stay on each worker.</Text>
          {workers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No workers yet</Text>
              <Text style={styles.hint}>Add workers first, then come back to build the crew.</Text>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push("/(tabs)/labour/new" as never)}>
                <Text style={styles.secondaryBtnText}>Add worker →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.chips}>
              {workers.map((w) => {
                const id = String(w.id);
                const on = selected.includes(id);
                return (
                  <Pressable key={id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(id)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {String(w.name || w.id)}
                      {w.dailyRate ? ` · ₹${w.dailyRate}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {selected.length ? <Text style={styles.selected}>{selected.length} selected</Text> : null}
          <Pressable style={[styles.btn, create.isPending && { opacity: 0.6 }]} onPress={submit} disabled={create.isPending}>
            {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save crew</Text>}
          </Pressable>
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
  secondaryBtn: { marginTop: 10 },
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
