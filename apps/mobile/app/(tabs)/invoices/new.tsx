import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useCreateInvoice,
  useExpenses,
  useMaterials,
  useProject,
  useQuote,
  useUpdateInvoice,
  useUpdateProject,
  useEstimate,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DateField } from "@/components/ui/DateField";
import { formatCurrency } from "@/lib/format";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type InvoiceLine = {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  unit: string;
  rate: string;
  source?: "work" | "estimate" | "expense" | "material";
};

type MaterialOpt = {
  id: string;
  name: string;
  unit?: string;
  purchase?: string;
  selling?: string;
};

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function newId() {
  return `il-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function amountFromRawLine(line: Record<string, unknown>): number {
  const qty = Number(line.quantity || 0);
  const rate = Number(line.rate || 0);
  const material = Number(line.materialCost || 0);
  const labour = Number(line.labourCost || 0);
  const equipment = Number(line.equipmentCost || 0);
  const other = Number(line.otherCost || 0);
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(qty) && qty > 0) return qty * rate;
  return material + labour + equipment + other;
}

function linesFromDoc(doc: Record<string, unknown> | undefined | null): Omit<InvoiceLine, "id" | "source">[] {
  if (!doc) return [];
  const normalized = (doc.line_items as Array<Record<string, unknown>>) || [];
  if (normalized.length) {
    return normalized.map((line) => ({
      description: String(line.description || "Estimate line"),
      amount: String(line.subtotal || line.total || "0"),
      quantity: String(line.quantity || "1"),
      unit: String(line.unit || ""),
      rate: String(line.unit_price || ""),
    }));
  }
  const raw = (doc.items as Array<Record<string, unknown>>) || [];
  return raw
    .map((line) => {
      const amount = amountFromRawLine(line);
      const qty = Number(line.quantity || 1) || 1;
      const rate = Number(line.rate || 0) > 0 ? Number(line.rate) : amount / qty;
      return {
        description: String(line.description || "Estimate line"),
        amount: String(Number.isFinite(amount) ? amount : 0),
        quantity: String(qty),
        unit: String(line.unit || ""),
        rate: String(Number.isFinite(rate) ? rate : 0),
      };
    })
    .filter((line) => Number(line.amount) > 0 || Boolean(line.description));
}

export default function NewInvoice() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const project = useProject(projectId);
  const quoteId = project.data?.quoteId ? String(project.data.quoteId) : undefined;
  const quote = useQuote(quoteId);
  const estimateId = quote.data?.estimateId ? String(quote.data.estimateId) : undefined;
  const estimate = useEstimate(estimateId);
  const expenses = useExpenses(projectId, Boolean(projectId));
  const { data: materialsData } = useMaterials();
  const create = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const updateProject = useUpdateProject();
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(plusDaysIso(15));
  const [completed, setCompleted] = useState(false);
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [seeded, setSeeded] = useState(false);

  const materials: MaterialOpt[] = useMemo(
    () =>
      (materialsData?.items ?? []).map((m) => ({
        id: String(m.id),
        name: String(m.name || m.sku || m.id),
        unit: m.unit ? String(m.unit) : undefined,
        purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
        selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
      })),
    [materialsData],
  );

  const billableExpenses = useMemo(
    () => (expenses.data?.items || []).filter((e) => e.billableToCustomer === true),
    [expenses.data],
  );

  useEffect(() => {
    setSeeded(false);
    setLines([]);
  }, [projectId]);

  useEffect(() => {
    if (!project.data || seeded) return;
    if (quoteId && quote.isLoading) return;
    if (estimateId && estimate.isLoading) return;
    if (expenses.isLoading) return;

    let estimateLines = linesFromDoc(quote.data as Record<string, unknown> | undefined);
    if (!estimateLines.length) {
      estimateLines = linesFromDoc(estimate.data as Record<string, unknown> | undefined);
    }

    const next: InvoiceLine[] = [];
    if (estimateLines.length) {
      for (const line of estimateLines) {
        next.push({ ...line, id: newId(), source: "estimate" });
      }
    } else {
      const contract = Number(project.data.contractValue || 0);
      const billed = Number(project.data.billedToDate || 0);
      const remaining = Math.max(0, contract - billed);
      const value = remaining || contract || 0;
      if (value > 0) {
        next.push({
          id: newId(),
          description: String(project.data.name || "Project work"),
          amount: String(value),
          quantity: "1",
          unit: "",
          rate: String(value),
          source: "work",
        });
      }
    }

    for (const exp of billableExpenses) {
      const amt = String(exp.amount || "0");
      const cat = String(exp.category || "other");
      const desc = exp.description ? ` — ${String(exp.description)}` : "";
      next.push({
        id: newId(),
        description: `Expense: ${cat}${desc}`,
        amount: amt,
        quantity: "1",
        unit: "",
        rate: amt,
        source: "expense",
      });
    }

    setLines(next);
    setSeeded(true);
  }, [
    project.data,
    quote.data,
    quote.isLoading,
    quoteId,
    estimate.data,
    estimate.isLoading,
    estimateId,
    expenses.isLoading,
    billableExpenses,
    seeded,
  ]);

  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.quantity !== undefined || patch.rate !== undefined) {
          const qty = Number(next.quantity || 0);
          const rate = Number(next.rate || 0);
          if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate)) {
            next.amount = String(qty * rate);
          }
        }
        return next;
      }),
    );
  }

  function addMaterial(material: MaterialOpt) {
    const rate = material.selling || material.purchase || "0";
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: material.name,
        quantity: "1",
        unit: material.unit || "pcs",
        rate,
        amount: String(Number(rate || 0)),
        source: "material",
      },
    ]);
  }

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
      Toast.show({ type: "error", text1: "Add estimate lines, materials, or expenses" });
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
          items: lines.map(({ description, amount, quantity, unit, rate }) => ({
            description,
            amount,
            quantity,
            unit,
            rate,
          })),
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

  const estimateLineCount = lines.filter((l) => l.source === "estimate").length;

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
              {estimateLineCount > 0 ? (
                <Text style={styles.meta}>Loaded {estimateLineCount} estimate/material line{estimateLineCount === 1 ? "" : "s"}</Text>
              ) : null}
            </View>

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

            <Text style={styles.section}>Add material from catalog</Text>
            {materials.length === 0 ? (
              <Text style={styles.hint}>No materials in catalog yet.</Text>
            ) : (
              <View style={styles.chips}>
                {materials.slice(0, 40).map((m) => (
                  <Pressable key={m.id} style={styles.chip} onPress={() => addMaterial(m)}>
                    <Text style={styles.chipText}>{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.section}>Invoice lines ({lines.length})</Text>
            {lines.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>No lines yet — add materials or check the linked estimate.</Text>
              </View>
            ) : (
              lines.map((line, idx) => (
                <View key={line.id} style={styles.lineCard}>
                  <View style={styles.lineHead}>
                    <Text style={styles.lineTitle}>
                      Line {idx + 1}
                      {line.source === "material" ? " · material" : line.source === "estimate" ? " · estimate" : ""}
                    </Text>
                    <Pressable onPress={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={styles.input}
                    value={line.description}
                    onChangeText={(v) => updateLine(line.id, { description: v })}
                    placeholderTextColor={p.faint}
                  />
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={line.quantity}
                    onChangeText={(v) => updateLine(line.id, { quantity: v })}
                    keyboardType="decimal-pad"
                    placeholderTextColor={p.faint}
                  />
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    value={line.unit}
                    onChangeText={(v) => updateLine(line.id, { unit: v })}
                    placeholderTextColor={p.faint}
                  />
                  <Text style={styles.label}>Rate</Text>
                  <TextInput
                    style={styles.input}
                    value={line.rate}
                    onChangeText={(v) => updateLine(line.id, { rate: v })}
                    keyboardType="decimal-pad"
                    placeholderTextColor={p.faint}
                  />
                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={line.amount}
                    onChangeText={(v) => updateLine(line.id, { amount: v })}
                    keyboardType="decimal-pad"
                    placeholderTextColor={p.faint}
                  />
                </View>
              ))
            )}

            <View style={[styles.card, styles.totalCard]}>
              <Text style={styles.totalLabel}>Invoice total</Text>
              <Text style={styles.totalAmt}>{formatCurrency(String(invoiceTotal))}</Text>
            </View>

            {billableExpenses.length > 0 ? (
              <Text style={styles.hint}>
                Includes {billableExpenses.length} billable expense{billableExpenses.length === 1 ? "" : "s"}.
              </Text>
            ) : (
              <Text style={styles.hint}>No billable expenses on this project yet. Labour from attendance is added by the server on create.</Text>
            )}

            <Pressable style={[styles.chipWide, completed && styles.chipOn]} onPress={() => setCompleted((v) => !v)}>
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
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
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
  totalCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  lineCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
  },
  lineHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineTitle: { color: p.text, fontWeight: "700" },
  remove: { color: p.clay, fontWeight: "700" },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
  },
  chipWide: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: p.surface,
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: p.clay },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
