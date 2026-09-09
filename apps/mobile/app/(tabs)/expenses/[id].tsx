import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useExpense, useUpdateExpense } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function ExpenseDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useExpense(id);
  const update = useUpdateExpense();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [description, setDescription] = useState("");
  const [billableToCustomer, setBillableToCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setCategory(String(data.category || ""));
    setAmount(String(data.amount || ""));
    setPaidBy(String(data.paidBy || ""));
    setDescription(String(data.description || ""));
    setBillableToCustomer(Boolean(data.billableToCustomer));
    setHydrated(true);
  }, [data, hydrated]);

  const backTo = projectId
    ? projectPath(String(projectId), "money")
    : data?.projectId
      ? projectPath(String(data.projectId), "money")
      : "/(tabs)/projects";

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: {
          category,
          amount,
          paidBy: paidBy || null,
          description: description || null,
          billableToCustomer,
        },
      });
      Toast.show({ type: "success", text1: "Saved" });
      refetch();
      router.replace(backTo as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Edit expense"
          subtitle={String(data?.category || "")}
          onBack={() => router.replace(backTo as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner
            message={(error as { userMessage?: string })?.userMessage || "Failed"}
            onRetry={() => refetch()}
          />
        ) : null}
        {data && hydrated ? (
          <>
            <Text style={styles.label}>Category</Text>
            <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Paid by</Text>
            <TextInput style={styles.input} value={paidBy} onChangeText={setPaidBy} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Description</Text>
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
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
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
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: p.border,
    backgroundColor: p.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: p.clay,
    borderColor: p.clay,
  },
  checkmark: { color: "#fff", fontWeight: "800", fontSize: 13, lineHeight: 16 },
  checkLabel: { color: p.text, fontWeight: "600", fontSize: 15 },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
