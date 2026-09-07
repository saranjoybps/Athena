import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSurvey, useCustomers, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewSurvey() {
  const router = useRouter();
  const { data: custData } = useCustomers();
  const { data: siteData } = useSites();
  const create = useCreateSurvey();
  const customers = custData?.items ?? [];
  const sites = siteData?.items ?? [];
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState("");

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(String(customers[0].id));
  }, [customers, customerId]);

  useEffect(() => {
    const filtered = sites.filter((s) => !customerId || String(s.customerId) === customerId);
    if (!siteId && filtered[0]?.id) setSiteId(String(filtered[0].id));
  }, [sites, customerId, siteId]);

  const filteredSites = sites.filter((s) => !customerId || String(s.customerId) === customerId);

  async function submit() {
    if (!customerId || !siteId) {
      Toast.show({ type: "error", text1: "Customer and site required" });
      return;
    }
    try {
      await create.mutateAsync({
        customerId,
        siteId,
        projectType: "painting",
        scope: scope || null,
        notes: notes || null,
      });
      Toast.show({ type: "success", text1: "Survey created" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New survey" onBack={() => router.back()} />
        <Text style={styles.label}>Customer</Text>
        <View style={styles.chips}>
          {customers.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, customerId === c.id && styles.chipOn]}
              onPress={() => {
                setCustomerId(c.id);
                setSiteId("");
              }}
            >
              <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{String(c.name)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Site</Text>
        <View style={styles.chips}>
          {filteredSites.map((s) => (
            <Pressable key={s.id} style={[styles.chip, siteId === s.id && styles.chipOn]} onPress={() => setSiteId(s.id)}>
              <Text style={[styles.chipText, siteId === s.id && styles.chipTextOn]}>{String(s.name)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Scope</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={scope} onChangeText={setScope} multiline placeholderTextColor={p.faint} />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save survey</Text>}
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
