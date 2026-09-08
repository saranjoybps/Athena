import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateChangeOrder, useProjects } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewChangeOrder() {
  const router = useRouter();
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const { data } = useProjects();
  const create = useCreateChangeOrder();
  const projects = data?.items ?? [];
  const [projectId, setProjectId] = useState(projectIdParam ? String(projectIdParam) : "");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (projectIdParam) setProjectId(String(projectIdParam));
  }, [projectIdParam]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(String(projects[0].id));
  }, [projects, projectId]);

  async function submit() {
    if (!projectId || !reason.trim() || !cost || !price) {
      Toast.show({ type: "error", text1: "Fill required fields" });
      return;
    }
    try {
      await create.mutateAsync({
        projectId,
        reason: reason.trim(),
        additionalScope: scope || null,
        additionalCost: cost,
        sellingPrice: price,
      });
      Toast.show({ type: "success", text1: "Change order created" });
      if (projectId) router.replace(projectPath(projectId, "field") as never);
      else router.replace("/(tabs)/projects" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  function goBack() {
    if (projectIdParam || projectId) {
      router.replace(projectPath(String(projectIdParam || projectId), "field") as never);
      return;
    }
    router.replace("/(tabs)/projects" as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New change order" onBack={goBack} />
        <Text style={styles.label}>Project</Text>
        <View style={styles.chips}>
          {projects.map((proj) => (
            <Pressable key={proj.id} style={[styles.chip, projectId === proj.id && styles.chipOn]} onPress={() => setProjectId(proj.id)}>
              <Text style={[styles.chipText, projectId === proj.id && styles.chipTextOn]} numberOfLines={1}>
                {String(proj.name || proj.number)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Reason *</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Additional scope</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={scope} onChangeText={setScope} multiline placeholderTextColor={p.faint} />
        <Text style={styles.label}>Cost *</Text>
        <TextInput style={styles.input} value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Selling price *</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface, maxWidth: "100%" },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
