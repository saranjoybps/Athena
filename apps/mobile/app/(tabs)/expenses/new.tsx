import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateExpense, useProjects } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewExpense() {
  const router = useRouter();
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const { data } = useProjects();
  const create = useCreateExpense();
  const projects = data?.items ?? [];
  const [projectId, setProjectId] = useState(projectIdParam ? String(projectIdParam) : "");
  const [category, setCategory] = useState("transport");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (projectIdParam) setProjectId(String(projectIdParam));
  }, [projectIdParam]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(String(projects[0].id));
  }, [projects, projectId]);

  async function submit() {
    try {
      await create.mutateAsync({
        projectId,
        category: category.trim() || "misc",
        amount: amount.trim(),
        description: description.trim() || undefined,
      });
      Toast.show({ type: "success", text1: "Expense logged" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Log expense" subtitle="Field spend" onBack={() => router.back()} />
        <Text style={styles.label}>Project</Text>
        <View style={styles.chips}>
          {projects.map((proj) => (
            <Pressable
              key={proj.id}
              style={[styles.chip, projectId === proj.id && styles.chipOn]}
              onPress={() => setProjectId(proj.id)}
            >
              <Text style={[styles.chipText, projectId === proj.id && styles.chipTextOn]} numberOfLines={1}>
                {String(proj.name || proj.number)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Amount (INR)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="850"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholderTextColor={p.faint}
        />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save expense</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg },
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
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
    maxWidth: "100%",
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
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
