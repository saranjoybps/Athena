import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateExpense, useProjects } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function NewExpense() {
  const router = useRouter();
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const { data } = useProjects();
  const create = useCreateExpense();
  const projects = data?.items ?? [];
  const projectId = projectIdParam ? String(projectIdParam) : "";
  const [category, setCategory] = useState("transport");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [billableToCustomer, setBillableToCustomer] = useState(false);

  const project = useMemo(
    () => projects.find((proj) => String(proj.id) === projectId),
    [projects, projectId],
  );

  useEffect(() => {
    if (!projectIdParam) {
      Toast.show({ type: "info", text1: "Open expense from a project", text2: "Project is required." });
    }
  }, [projectIdParam]);

  async function submit() {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Open this screen from a project" });
      return;
    }
    try {
      await create.mutateAsync({
        projectId,
        category: category.trim() || "misc",
        amount: amount.trim(),
        description: description.trim() || undefined,
        billableToCustomer,
      });
      Toast.show({ type: "success", text1: "Expense logged" });
      router.replace(projectPath(projectId, "money") as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  function goBack() {
    if (projectId) {
      router.replace(projectPath(projectId, "money") as never);
      return;
    }
    router.replace("/(tabs)/projects" as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Log expense" subtitle="Tied to this project" onBack={goBack} />
        <Text style={styles.label}>Project</Text>
        <View style={styles.lockedBox}>
          <Text style={styles.lockedText}>
            {project ? String(project.name || project.number || project.id) : projectId || "No project"}
          </Text>
        </View>
        {!projectId ? (
          <Text style={styles.hint}>Open Log expense from a project’s Money tab — project is auto-selected.</Text>
        ) : null}
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
        <Pressable
          style={styles.checkRow}
          onPress={() => setBillableToCustomer((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: billableToCustomer }}
        >
          <View style={[styles.checkbox, billableToCustomer && styles.checkboxOn]}>
            {billableToCustomer ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Billable to customer</Text>
        </Pressable>
        <Pressable style={[styles.btn, !projectId && { opacity: 0.5 }]} onPress={submit} disabled={create.isPending || !projectId}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save expense</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  hint: { color: p.muted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  lockedBox: {
    backgroundColor: p.claySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  lockedText: { color: p.clayDark, fontWeight: "700" },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: p.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
  },
  checkboxOn: { backgroundColor: p.clay, borderColor: p.clay },
  checkmark: { color: "#fff", fontWeight: "800", fontSize: 12 },
  checkLabel: { color: p.text, fontWeight: "600" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
