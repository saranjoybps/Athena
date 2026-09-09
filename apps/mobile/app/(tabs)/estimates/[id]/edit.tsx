import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useEstimate, useMaterials, useReviseEstimate } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Line = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  materialCost: string;
  labourCost: string;
  rate: string;
};

type MaterialOpt = {
  id: string;
  name: string;
  unit?: string;
  purchase?: string;
  selling?: string;
};

function newLine(): Line {
  return {
    id: `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    description: "Painting works",
    quantity: "1",
    unit: "sqft",
    materialCost: "0",
    labourCost: "0",
    rate: "",
  };
}

function lineFromApi(item: Record<string, unknown>, idx: number): Line {
  return {
    id: `ln-${idx}-${String(item.id || idx)}`,
    description: String(item.description || ""),
    quantity: String(item.quantity || "1"),
    unit: String(item.unit || "sqft"),
    materialCost: String(item.materialCost || "0"),
    labourCost: String(item.labourCost || "0"),
    rate: item.rate != null ? String(item.rate) : "",
  };
}

export default function EditEstimate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: estimate, isLoading, isError, error, refetch } = useEstimate(id);
  const { data: materialsData } = useMaterials();
  const revise = useReviseEstimate();

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

  const [title, setTitle] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!estimate || loaded) return;
    setTitle(String(estimate.title || ""));
    setAssumptions(String(estimate.assumptions || ""));
    const taxRate = Number(estimate.taxRate || 0);
    setGstPercent(taxRate > 0 ? String(taxRate * 100) : "");
    const items = (estimate.items as Record<string, unknown>[]) || [];
    setLines(items.length ? items.map(lineFromApi) : [newLine()]);
    setLoaded(true);
  }, [estimate, loaded]);

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }

  function applyMaterial(lineId: string, material: MaterialOpt) {
    updateLine(lineId, {
      description: material.name,
      ...(material.unit ? { unit: material.unit } : {}),
      ...(material.purchase ? { materialCost: material.purchase } : {}),
      ...(material.selling ? { rate: material.selling } : {}),
    });
  }

  async function submit() {
    if (!estimate) return;
    if (!title.trim()) {
      Toast.show({ type: "error", text1: "Title required" });
      return;
    }
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add at least one line" });
      return;
    }
    const pct = Number(gstPercent.trim());
    const taxRate = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";
    try {
      await revise.mutateAsync({
        id: String(id),
        body: {
          customerId: String(estimate.customerId),
          siteId: String(estimate.siteId),
          title: title.trim(),
          assumptions: assumptions.trim() || null,
          taxRate,
          items: lines.map((l) => ({
            description: l.description || "Works",
            quantity: l.quantity || "1",
            unit: l.unit || "sqft",
            materialCost: l.materialCost || "0",
            labourCost: l.labourCost || "0",
            rate: l.rate || null,
          })),
        },
      });
      Toast.show({ type: "success", text1: "Estimate updated" });
      router.back();
    } catch (e) {
      const msg = (e as { userMessage?: string })?.userMessage || "Save failed";
      Toast.show({ type: "error", text1: msg.includes("locked") ? "Estimate locked" : "Failed", text2: msg });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Edit estimate" subtitle="Revise line items" onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {estimate ? (
          <>
            <Text style={styles.locked}>Customer and site are locked for this estimate.</Text>
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Assumptions</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={assumptions}
              onChangeText={setAssumptions}
              multiline
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

            <Text style={styles.section}>Line items</Text>
            {lines.map((line, idx) => (
              <View key={line.id} style={styles.lineCard}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineTitle}>Line {idx + 1}</Text>
                  {lines.length > 1 ? (
                    <Pressable onPress={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.label}>Material from catalog</Text>
                {materials.length === 0 ? (
                  <Text style={styles.hint}>No materials in catalog yet.</Text>
                ) : (
                  <View style={styles.chips}>
                    {materials.slice(0, 40).map((m) => (
                      <Pressable key={m.id} style={styles.chip} onPress={() => applyMaterial(line.id, m)}>
                        <Text style={styles.chipText}>{m.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Text style={styles.label}>Description *</Text>
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
                <Text style={styles.label}>Material cost</Text>
                <TextInput
                  style={styles.input}
                  value={line.materialCost}
                  onChangeText={(v) => updateLine(line.id, { materialCost: v })}
                  keyboardType="decimal-pad"
                  placeholderTextColor={p.faint}
                />
                <Text style={styles.label}>Labour cost</Text>
                <TextInput
                  style={styles.input}
                  value={line.labourCost}
                  onChangeText={(v) => updateLine(line.id, { labourCost: v })}
                  keyboardType="decimal-pad"
                  placeholderTextColor={p.faint}
                />
                <Text style={styles.label}>Selling rate (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={line.rate}
                  onChangeText={(v) => updateLine(line.id, { rate: v })}
                  keyboardType="decimal-pad"
                  placeholderTextColor={p.faint}
                />
              </View>
            ))}
            <Pressable style={styles.addLine} onPress={() => setLines((prev) => [...prev, newLine()])}>
              <Text style={styles.addLineText}>+ Add line</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={submit} disabled={revise.isPending}>
              {revise.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
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
  locked: { color: p.muted, fontSize: 13, marginBottom: 4 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
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
