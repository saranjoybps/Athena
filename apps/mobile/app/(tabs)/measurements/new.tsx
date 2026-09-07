import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateMeasurement, useSite } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewMeasurement() {
  const router = useRouter();
  const { siteId } = useLocalSearchParams<{ siteId?: string }>();
  const { data: site } = useSite(siteId);
  const create = useCreateMeasurement();
  const [wallArea, setWallArea] = useState("");
  const [ceilingArea, setCeilingArea] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!siteId) Toast.show({ type: "error", text1: "Open from a site" });
  }, [siteId]);

  async function submit() {
    if (!siteId || !site?.customerId) {
      Toast.show({ type: "error", text1: "Site required" });
      return;
    }
    try {
      await create.mutateAsync({
        siteId,
        customerId: site.customerId,
        formulaKind: "painting",
        originalUnit: "sqft",
        inputs: { wallArea: Number(wallArea || 0), ceilingArea: Number(ceilingArea || 0) },
        notes: notes || null,
      });
      Toast.show({ type: "success", text1: "Measurement saved" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New measurement" subtitle={String(site?.name || "Site")} onBack={() => router.back()} />
        <Text style={styles.label}>Wall area (sqft)</Text>
        <TextInput style={styles.input} value={wallArea} onChangeText={setWallArea} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Ceiling area (sqft)</Text>
        <TextInput style={styles.input} value={ceilingArea} onChangeText={setCeilingArea} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
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
