import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateEstimate, useCustomers, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { customerPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Line = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  materialCost: string;
  labourCost: string;
  rate: string;
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

export default function NewEstimate() {
  const { siteId: siteParam, customerId: customerParam } = useLocalSearchParams<{
    siteId?: string;
    customerId?: string;
  }>();
  const router = useRouter();
  const { data: custData } = useCustomers();
  const { data: siteData } = useSites();
  const create = useCreateEstimate();
  const customers = custData?.items ?? [];
  const sites = siteData?.items ?? [];
  const [customerId, setCustomerId] = useState(customerParam || "");
  const [siteId, setSiteId] = useState(siteParam || "");
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
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!customerId || !siteId || !title.trim()) {
      Toast.show({ type: "error", text1: "Customer, site, and title required" });
      return;
    }
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add at least one line" });
      return;
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
          description: l.description || "Works",
          quantity: l.quantity || "1",
          unit: l.unit || "sqft",
          materialCost: l.materialCost || "0",
          labourCost: l.labourCost || "0",
          rate: l.rate || null,
        })),
      });
      Toast.show({ type: "success", text1: "Estimate created" });
      router.replace(customerPath(customerId, "estimates") as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const backHref = customerId ? customerPath(customerId, "estimates") : "/(tabs)/customers";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New estimate" subtitle="Price the job" onBack={() => router.replace(backHref as never)} />
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

        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create estimate</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16 },
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
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
