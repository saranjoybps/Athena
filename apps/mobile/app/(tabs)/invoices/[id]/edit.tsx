import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useInvoice, useMaterials, useUpdateInvoice } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DateField } from "@/components/ui/DateField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type InvoiceLine = {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  unit: string;
  rate: string;
  labourCost: string;
  gstRate: string;
};

type MaterialOpt = {
  id: string;
  name: string;
  unit?: string;
  purchase?: string;
  selling?: string;
  gstRate?: string;
};

function newId() {
  return `il-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function lineFromApi(line: Record<string, unknown>, idx: number): InvoiceLine {
  const qty = String(line.quantity || "1");
  const rate = line.rate != null ? String(line.rate) : line.unit_price != null ? String(line.unit_price) : "";
  const amount = String(line.amount || line.subtotal || line.total || "0");
  const gstRaw = line.gstRate != null ? Number(line.gstRate) : NaN;
  // API stores gst as fraction (0.18); show as percent in the form
  const gstPct =
    Number.isFinite(gstRaw) && gstRaw > 0 ? (gstRaw <= 1 ? String(gstRaw * 100) : String(gstRaw)) : "";
  return {
    id: newId() + idx,
    description: String(line.description || ""),
    quantity: qty,
    unit: String(line.unit || ""),
    rate,
    amount,
    labourCost: String(line.labourCost || "0"),
    gstRate: gstPct,
  };
}

export default function EditInvoice() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id);
  const { data: materialsData } = useMaterials();
  const update = useUpdateInvoice();

  const materials: MaterialOpt[] = useMemo(
    () =>
      (materialsData?.items ?? []).map((m) => ({
        id: String(m.id),
        name: String(m.name || m.sku || m.id),
        unit: m.unit ? String(m.unit) : undefined,
        purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
        selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
        gstRate: m.gstRate != null ? String(m.gstRate) : undefined,
      })),
    [materialsData],
  );

  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!invoice || loaded) return;
    setNotes(String(invoice.notes || ""));
    setDueDate(String(invoice.dueDate || "").slice(0, 10));
    const taxRate = Number((invoice.tax as { rate?: string } | undefined)?.rate || invoice.taxRate || 0);
    if (Number.isFinite(taxRate) && taxRate > 0) {
      setGstPercent(String(taxRate <= 1 ? taxRate * 100 : taxRate));
    }
    const raw =
      (invoice.line_items as Record<string, unknown>[]) ||
      (invoice.items as Record<string, unknown>[]) ||
      [];
    setLines(raw.length ? raw.map(lineFromApi) : []);
    setLoaded(true);
  }, [invoice, loaded]);

  function recalcAmount(line: InvoiceLine): string {
    const qty = Number(line.quantity || 0);
    const rate = Number(line.rate || 0);
    const labour = Number(line.labourCost || 0) || 0;
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate)) {
      return String(qty * rate + labour);
    }
    return String((Number(line.amount || 0) || 0) + labour);
  }

  function updateLine(lineId: string, patch: Partial<InvoiceLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        if (patch.quantity !== undefined || patch.rate !== undefined || patch.labourCost !== undefined) {
          next.amount = recalcAmount(next);
        }
        return next;
      }),
    );
  }

  function addMaterial(material: MaterialOpt) {
    const rate = material.selling || material.purchase || "0";
    const gstRaw = material.gstRate != null ? Number(material.gstRate) : NaN;
    const gstPct = Number.isFinite(gstRaw) && gstRaw > 0 ? (gstRaw <= 1 ? String(gstRaw * 100) : String(gstRaw)) : "";
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: material.name,
        quantity: "1",
        unit: material.unit || "pcs",
        rate,
        labourCost: "0",
        gstRate: gstPct,
        amount: String(Number(rate || 0)),
      },
    ]);
  }

  async function submit() {
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add at least one line" });
      return;
    }
    try {
      const pct = Number(gstPercent.trim());
      const taxRate = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";
      await update.mutateAsync({
        id: String(id),
        body: {
          notes: notes.trim() || null,
          dueDate: dueDate || null,
          taxRate,
          placeOfSupply: "Tamil Nadu",
          supplierState: "Tamil Nadu",
          items: lines.map(({ description, amount, quantity, unit, rate, labourCost, gstRate }) => {
            const linePct = Number(gstRate || 0);
            return {
              description,
              amount,
              quantity,
              unit,
              rate,
              labourCost: labourCost || "0",
              gstRate: Number.isFinite(linePct) && linePct > 0 ? String(linePct / 100) : undefined,
            };
          }),
        },
      });
      Toast.show({ type: "success", text1: "Invoice updated" });
      router.replace(`/(tabs)/invoices/${id}${projectId ? `?projectId=${projectId}` : ""}` as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const status = String(invoice?.status || "draft");
  const canEdit = status !== "paid" && status !== "void";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Edit invoice" subtitle={String(invoice?.number || "")} onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {!canEdit && invoice ? (
          <Text style={styles.locked}>Paid or void invoices cannot be edited.</Text>
        ) : null}
        {invoice && canEdit ? (
          <>
            <DateField label="Due date" value={dueDate} onChange={setDueDate} />
            <Text style={styles.label}>GST % (invoice)</Text>
            <TextInput
              style={styles.input}
              value={gstPercent}
              onChangeText={setGstPercent}
              keyboardType="decimal-pad"
              placeholder="e.g. 18"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={notes}
              onChangeText={setNotes}
              multiline
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
            {lines.map((line, idx) => (
              <View key={line.id} style={styles.lineCard}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineTitle}>Line {idx + 1}</Text>
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
                <Text style={styles.label}>Labour charge</Text>
                <TextInput
                  style={styles.input}
                  value={line.labourCost}
                  onChangeText={(v) => updateLine(line.id, { labourCost: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={p.faint}
                />
                <Text style={styles.label}>GST % (line)</Text>
                <TextInput
                  style={styles.input}
                  value={line.gstRate}
                  onChangeText={(v) => updateLine(line.id, { gstRate: v })}
                  keyboardType="decimal-pad"
                  placeholder="Optional — overrides blank invoice GST"
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
            ))}
            <Pressable
              style={styles.addLine}
              onPress={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    id: newId(),
                    description: "",
                    quantity: "1",
                    unit: "pcs",
                    rate: "0",
                    labourCost: "0",
                    gstRate: "",
                    amount: "0",
                  },
                ])
              }
            >
              <Text style={styles.addLineText}>+ Add line</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={submit} disabled={update.isPending}>
              {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
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
  locked: { color: p.muted, textAlign: "center", marginVertical: 12 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  multi: { minHeight: 80, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipText: { color: p.muted, fontSize: 13 },
  lineCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginTop: 10,
  },
  lineHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineTitle: { color: p.text, fontWeight: "700" },
  remove: { color: p.clay, fontWeight: "700" },
  addLine: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: p.surface,
  },
  addLineText: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
