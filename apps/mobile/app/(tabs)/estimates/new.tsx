import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateEstimate, useCustomers, useEnsureEstimatePdf, useMaterials, useMeasurements, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { customerPath } from "@/lib/nav";
import { siteMeasurementOptions } from "@/lib/measurements";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Line = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  materialCost: string;
  labourCost: string;
  rate: string;
  catalogMaterialId: string;
  unitPurchase: string;
  measurementId: string;
  measurementItemId: string;
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
    description: "",
    quantity: "1",
    unit: "sqft",
    materialCost: "0",
    labourCost: "0",
    rate: "",
    catalogMaterialId: "",
    unitPurchase: "",
    measurementId: "",
    measurementItemId: "",
  };
}

export default function NewEstimate() {
  const { siteId: siteParam, customerId: customerParam } = useLocalSearchParams<{
    siteId?: string;
    customerId?: string;
  }>();
  const router = useRouter();
  const { data: custData } = useCustomers();
  const { data: siteData } = useSites();
  const { data: materialsData } = useMaterials();
  const [customerId, setCustomerId] = useState(customerParam || "");
  const [siteId, setSiteId] = useState(siteParam || "");
  const { data: measurementsData } = useMeasurements(siteId || undefined);
  const create = useCreateEstimate();
  const ensurePdf = useEnsureEstimatePdf();
  const customers = custData?.items ?? [];
  const sites = siteData?.items ?? [];
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
  const measurementOptions = useMemo(
    () => (siteId ? siteMeasurementOptions((measurementsData?.items ?? []) as Array<Record<string, unknown>>) : []),
    [measurementsData, siteId],
  );
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [assumptions, setAssumptions] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    if (customerParam) setCustomerId(customerParam);
  }, [customerParam]);

  useEffect(() => {
    if (siteParam) setSiteId(siteParam);
  }, [siteParam]);

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(String(customers[0].id));
  }, [customers, customerId]);

  useEffect(() => {
    if (siteParam) return;
    const filtered = sites.filter((s) => !customerId || String(s.customerId) === customerId);
    if (!siteId && filtered[0]?.id) setSiteId(String(filtered[0].id));
  }, [sites, customerId, siteId, siteParam]);

  const filteredSites = sites.filter((s) => !customerId || String(s.customerId) === customerId);
  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(customerId)),
    [customers, customerId],
  );
  const selectedSite = useMemo(
    () => filteredSites.find((s) => String(s.id) === String(siteId)),
    [filteredSites, siteId],
  );
  const autoTitle = useMemo(() => {
    const customerName = String(selectedCustomer?.name || "").trim();
    const siteName = String(selectedSite?.name || "").trim();
    if (customerName && siteName) return `${customerName} — ${siteName}`;
    if (customerName) return `${customerName} — Estimate`;
    return "Estimate";
  }, [selectedCustomer, selectedSite]);

  useEffect(() => {
    if (!titleTouched) setTitle(autoTitle);
  }, [autoTitle, titleTouched]);

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        // Keep material cost in sync with qty × unit purchase when catalog material is linked
        if (patch.quantity !== undefined && next.catalogMaterialId && next.unitPurchase) {
          const qty = Number(next.quantity || 0);
          const unit = Number(next.unitPurchase || 0);
          if (Number.isFinite(qty) && Number.isFinite(unit)) {
            next.materialCost = String(qty * unit);
          }
        }
        return next;
      }),
    );
  }

  function applyMaterial(lineId: string, material: MaterialOpt) {
    const line = lines.find((l) => l.id === lineId);
    const qty = Number(line?.quantity || 1) || 1;
    const purchase = material.purchase != null && material.purchase !== "" ? Number(material.purchase) : NaN;
    updateLine(lineId, {
      catalogMaterialId: material.id,
      unitPurchase: Number.isFinite(purchase) ? String(purchase) : "",
      ...(material.unit ? { unit: material.unit } : {}),
      ...(material.selling ? { rate: material.selling } : {}),
      ...(Number.isFinite(purchase) ? { materialCost: String(purchase * qty) } : {}),
    });
    Toast.show({
      type: "success",
      text1: "Rates applied",
      text2: material.selling
        ? `${material.name} · sell ${material.selling}`
        : Number.isFinite(purchase)
          ? `${material.name} · cost applied`
          : `${material.name} (no catalog prices — set rate manually)`,
    });
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const qty = Number(l.quantity || 0) || 0;
      const rate = Number(l.rate || 0) || 0;
      if (rate > 0) return sum + qty * rate;
      return sum + (Number(l.materialCost || 0) || 0) + (Number(l.labourCost || 0) || 0);
    }, 0);
    const pct = Number(gstPercent.trim());
    const gst = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? (subtotal * pct) / 100 : 0;
    return { subtotal, gst, grand: subtotal + gst };
  }, [lines, gstPercent]);

  async function submit() {
    if (!customerId || !siteId || !title.trim()) {
      Toast.show({ type: "error", text1: "Customer, site, and title required" });
      return;
    }
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add at least one work package" });
      return;
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        Toast.show({ type: "error", text1: "Each work package needs a description" });
        return;
      }
    }
    try {
      const pct = Number(gstPercent.trim());
      const taxRate =
        gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";
      const est = await create.mutateAsync({
        customerId,
        siteId,
        title: title.trim(),
        assumptions: assumptions.trim() || null,
        taxRate,
        items: lines.map((l) => ({
          description: l.description.trim(),
          quantity: l.quantity || "1",
          unit: l.unit || "sqft",
          materialCost: l.materialCost || "0",
          labourCost: l.labourCost || "0",
          rate: l.rate || null,
          catalogMaterialId: l.catalogMaterialId || null,
          measurementId: l.measurementId || null,
          measurementItemId: l.measurementItemId || null,
        })),
      });
      try {
        await ensurePdf.mutateAsync(String(est.id));
      } catch {
        /* PDF optional at create */
      }
      Toast.show({ type: "success", text1: "Estimate created" });
      router.replace(`/(tabs)/estimates/${est.id}?customerId=${customerId}` as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const backHref = customerId ? customerPath(customerId, "estimates") : "/(tabs)/customers";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="New estimate"
          subtitle="Work packages — catalog fills rates only"
          onBack={() => router.replace(backHref as never)}
        />
        {!customerParam ? (
          <>
            <Text style={styles.label}>Customer</Text>
            <View style={styles.chips}>
              {customers.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, customerId === c.id && styles.chipOn]}
                  onPress={() => {
                    setCustomerId(c.id);
                    setSiteId("");
                    setTitleTouched(false);
                  }}
                >
                  <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{String(c.name)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.label}>Site *</Text>
        <View style={styles.chips}>
          {filteredSites.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.chip, siteId === s.id && styles.chipOn]}
              onPress={() => {
                setSiteId(s.id);
                setTitleTouched(false);
              }}
            >
              <Text style={[styles.chipText, siteId === s.id && styles.chipTextOn]}>{String(s.name)}</Text>
            </Pressable>
          ))}
        </View>
        {filteredSites.length === 0 ? <Text style={{ color: p.muted }}>Add a site for this customer first.</Text> : null}
        {filteredSites.length > 1 ? (
          <Text style={{ color: p.muted, marginTop: 4, fontSize: 12 }}>This customer has multiple sites — pick one.</Text>
        ) : null}
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={(v) => {
            setTitleTouched(true);
            setTitle(v);
          }}
          placeholder="Interior painting"
          placeholderTextColor={p.faint}
        />
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

        <Text style={styles.section}>From measurement (this site)</Text>
        <Text style={styles.hint}>Only measurements for the selected site. Tap to add total sqft as a work package.</Text>
        {!siteId ? <Text style={styles.hint}>Select a site first.</Text> : null}
        {siteId && measurementOptions.length === 0 ? (
          <Text style={styles.hint}>No measurements on this site yet.</Text>
        ) : null}
        <View style={styles.chips}>
          {measurementOptions.map((opt) => (
            <Pressable
              key={opt.value}
              style={styles.chip}
              onPress={() => {
                setLines((prev) => [
                  ...prev,
                  {
                    ...newLine(),
                    description: opt.label.split(" · ")[0] || opt.label,
                    quantity: String(opt.quantity || 1),
                    unit: opt.unit || "sqft",
                    measurementId: opt.measurementId,
                    measurementItemId: opt.itemId,
                  },
                ]);
                Toast.show({ type: "success", text1: "Measurement added", text2: `${opt.quantity} sqft` });
              }}
            >
              <Text style={styles.chipText} numberOfLines={2}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Work packages</Text>
        {lines.map((line, idx) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineHead}>
              <Text style={styles.lineTitle}>Work package {idx + 1}</Text>
              {lines.length > 1 ? (
                <Pressable onPress={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.label}>Work description *</Text>
            <TextInput
              style={styles.input}
              value={line.description}
              onChangeText={(v) => updateLine(line.id, { description: v })}
              placeholder="e.g. Interior painting – hall"
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
            <Text style={styles.label}>Sell rate (₹ / unit)</Text>
            <TextInput
              style={styles.input}
              value={line.rate}
              onChangeText={(v) => updateLine(line.id, { rate: v })}
              keyboardType="decimal-pad"
              placeholder="Customer price"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Apply rates from catalog (optional)</Text>
            {materials.length === 0 ? (
              <Text style={styles.hint}>No materials in catalog yet — enter rate/cost manually.</Text>
            ) : (
              <>
                <Text style={styles.hint}>Fills sell rate + material cost — does not rename this work package.</Text>
                <View style={styles.chips}>
                  {materials.slice(0, 40).map((m) => {
                    const on = line.catalogMaterialId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => applyMaterial(line.id, m)}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {m.name}
                          {m.selling ? ` · ${m.selling}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <Text style={styles.label}>Material cost (internal)</Text>
            <TextInput
              style={styles.input}
              value={line.materialCost}
              onChangeText={(v) => updateLine(line.id, { materialCost: v })}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Labour cost (internal)</Text>
            <TextInput
              style={styles.input}
              value={line.labourCost}
              onChangeText={(v) => updateLine(line.id, { labourCost: v })}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />
          </View>
        ))}
        <Pressable style={styles.addLine} onPress={() => setLines((prev) => [...prev, newLine()])}>
          <Text style={styles.addLineText}>+ Add work package</Text>
        </Pressable>

        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          {totals.gst > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.gst)}</Text>
            </View>
          ) : null}
          <View style={[styles.totalRow, styles.totalGrand]}>
            <Text style={styles.grandLabel}>Estimate total</Text>
            <Text style={styles.grandValue}>{formatCurrency(totals.grand)}</Text>
          </View>
        </View>

        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create estimate</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 4 },
  locked: { color: p.muted, marginBottom: 8 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
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
  totalCard: {
    marginTop: spacing.lg,
    backgroundColor: p.claySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#FDBA74",
    gap: 8,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: p.muted, fontWeight: "600" },
  totalValue: { color: p.text, fontWeight: "700" },
  totalGrand: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#FDBA74" },
  grandLabel: { color: p.clayDark, fontWeight: "800", fontSize: 16 },
  grandValue: { color: p.clayDark, fontWeight: "800", fontSize: 18 },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
