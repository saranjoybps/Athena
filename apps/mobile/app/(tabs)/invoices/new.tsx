import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateInvoice, useExpenses, useProject, useUpdateInvoice, useUpdateProject } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DateField } from "@/components/ui/DateField";
import { formatCurrency } from "@/lib/format";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type InvoiceLine = {
  description: string;
  amount: string;
  quantity: string;
  unit: string;
  rate: string;
};

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NewInvoice() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const project = useProject(projectId);
  const expenses = useExpenses(projectId, Boolean(projectId));
  const create = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const updateProject = useUpdateProject();
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(plusDaysIso(15));
  const [completed, setCompleted] = useState(false);
  const [workAmount, setWorkAmount] = useState("");
  const [gstPercent, setGstPercent] = useState("");

  useEffect(() => {
    if (project.data && !workAmount) {
      const contract = Number(project.data.contractValue || 0);
      const billed = Number(project.data.billedToDate || 0);
      const remaining = Math.max(0, contract - billed);
      setWorkAmount(String(remaining || project.data.contractValue || "0"));
    }
  }, [project.data, workAmount]);

  const billableExpenses = useMemo(
    () => (expenses.data?.items || []).filter((e) => e.billableToCustomer === true),
    [expenses.data],
  );

  const lines = useMemo(() => {
    const items: InvoiceLine[] = [];
    const value = Number(workAmount || 0);
    if (Number.isFinite(value) && value > 0) {
      items.push({
        description: String(project.data?.name || "Project work"),
        amount: String(value),
        quantity: "1",
        unit: "",
        rate: String(value),
      });
    }
    for (const exp of billableExpenses) {
      const amt = String(exp.amount || "0");
      const cat = String(exp.category || "other");
      const desc = exp.description ? ` — ${String(exp.description)}` : "";
      items.push({
        description: `Expense: ${cat}${desc}`,
        amount: amt,
        quantity: "1",
        unit: "",
        rate: amt,
      });
    }
    return items;
  }, [workAmount, billableExpenses, project.data]);

  const linesSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [lines],
  );

  const invoiceTotal = useMemo(() => {
    const pct = Number(gstPercent.trim());
    if (gstPercent.trim() && Number.isFinite(pct) && pct > 0) {
      return linesSubtotal * (1 + pct / 100);
    }
    return linesSubtotal;
  }, [linesSubtotal, gstPercent]);

  async function submit() {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Open Create invoice from a project" });
      return;
    }
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add a work amount or billable expense" });
      return;
    }
    if (!dueDate) {
      Toast.show({ type: "error", text1: "Due date is required" });
      return;
    }
    const pct = Number(gstPercent.trim());
    const taxRate = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";
    try {
      const invoice = await create.mutateAsync({
        body: {
          projectId,
          kind: completed ? "final" : "progress",
          overrideCap: true,
          taxRate,
          items: lines,
        },
        key: `mobile-inv-${projectId}-${Date.now()}`,
      });
      await updateProject.mutateAsync({
        id: projectId,
        body: { status: completed ? "completed" : "active" },
      });
      if (invoice.id) {
        await updateInvoice.mutateAsync({
          id: String(invoice.id),
          body: {
            notes: notes.trim() || null,
            dueDate: dueDate || null,
          },
        });
      }
      Toast.show({ type: "success", text1: "Invoice created" });
      router.replace(`/(tabs)/invoices/${invoice.id}?projectId=${projectId}` as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Create invoice"
          subtitle={project.data ? String(project.data.name || project.data.number || "") : "Project money"}
          onBack={() =>
            router.replace((projectId ? projectPath(projectId, "money") : "/(tabs)/projects") as never)
          }
        />
        {!projectId ? (
          <Text style={styles.err}>Open Create invoice from a project’s Money tab.</Text>
        ) : null}
        {project.isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {project.data ? (
          <>
            <View style={styles.card}>
              <Text style={styles.meta}>Contract {formatCurrency(String(project.data.contractValue || 0))}</Text>
              <Text style={styles.meta}>Already billed {formatCurrency(String(project.data.billedToDate || 0))}</Text>
            </View>

            <Text style={styles.label}>Work / progress amount *</Text>
            <TextInput
              style={styles.input}
              value={workAmount}
              onChangeText={setWorkAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />

            <DateField label="Due date *" value={dueDate} onChange={setDueDate} />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Payment terms, bank details…"
              placeholderTextColor={p.faint}
            />

            <Text style={styles.label}>GST % (optional)</Text>
            <TextInput
              style={styles.input}
              value={gstPercent}
              onChangeText={setGstPercent}
              keyboardType="decimal-pad"
              placeholder="Leave blank for no GST"
              placeholderTextColor={p.faint}
            />

            <Text style={styles.section}>Invoice lines ({lines.length})</Text>
            <View style={styles.card}>
              {lines.length === 0 ? <Text style={styles.meta}>No lines yet.</Text> : null}
              {lines.map((line, idx) => (
                <View key={`${line.description}-${idx}`} style={styles.lineRow}>
                  <Text style={styles.lineDesc} numberOfLines={2}>
                    {line.description}
                  </Text>
                  <Text style={styles.lineAmt}>{formatCurrency(line.amount)}</Text>
                </View>
              ))}
              <View style={[styles.lineRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Invoice total</Text>
                <Text style={styles.totalAmt}>{formatCurrency(String(invoiceTotal))}</Text>
              </View>
            </View>
            {billableExpenses.length > 0 ? (
              <Text style={styles.hint}>
                Includes {billableExpenses.length} billable expense{billableExpenses.length === 1 ? "" : "s"} at the end.
              </Text>
            ) : (
              <Text style={styles.hint}>No billable expenses on this project yet.</Text>
            )}

            <Pressable style={[styles.chip, completed && styles.chipOn]} onPress={() => setCompleted((v) => !v)}>
              <Text style={[styles.chipText, completed && styles.chipTextOn]}>
                {completed ? "✓ Project completed (final invoice)" : "Mark project completed?"}
              </Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
              {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create invoice</Text>}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  err: { color: p.red, marginBottom: spacing.md },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.md,
    gap: 8,
  },
  meta: { color: p.muted },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 8,
  },
  hint: { color: p.muted, fontSize: 13, marginTop: -4, marginBottom: 8 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  lineDesc: { flex: 1, color: p.text, fontSize: 14 },
  lineAmt: { color: p.text, fontWeight: "700" },
  totalRow: { borderTopWidth: 1, borderTopColor: p.border, paddingTop: 8, marginTop: 4 },
  totalLabel: { color: p.text, fontWeight: "700" },
  totalAmt: { color: p.clay, fontWeight: "800" },
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
  multi: { minHeight: 80, textAlignVertical: "top" },
  chip: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: p.surface,
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontWeight: "600" },
  chipTextOn: { color: p.clay },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
