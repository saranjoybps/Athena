import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateMeasurement, useCustomers, useSite, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { MeasurementEditor } from "@/components/ui/MeasurementEditor";
import { buildMeasurementPayload, createMeasurementItem, MeasurementItem } from "@/lib/measurements";
import { customerPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewMeasurement() {
  const router = useRouter();
  const { siteId: siteParam, customerId: customerParam } = useLocalSearchParams<{
    siteId?: string;
    customerId?: string;
  }>();
  const { data: custData } = useCustomers();
  const { data: siteData } = useSites();
  const create = useCreateMeasurement();
  const customers = custData?.items ?? [];
  const sites = siteData?.items ?? [];
  const [customerId, setCustomerId] = useState(customerParam || "");
  const [siteId, setSiteId] = useState(siteParam || "");
  const { data: site } = useSite(siteId || undefined);
  const [items, setItems] = useState<MeasurementItem[]>([createMeasurementItem("room", "Room 1")]);
  const [notes, setNotes] = useState("");

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
  const resolvedCustomerId = customerId || (site?.customerId ? String(site.customerId) : "");

  async function submit() {
    if (!siteId || !resolvedCustomerId) {
      Toast.show({ type: "error", text1: "Customer and site required" });
      return;
    }
    if (!items.length) {
      Toast.show({ type: "error", text1: "Add at least one measurement line" });
      return;
    }
    try {
      const payload = buildMeasurementPayload(items, notes || null);
      await create.mutateAsync({
        siteId,
        customerId: resolvedCustomerId,
        ...payload,
      });
      Toast.show({ type: "success", text1: "Measurement saved" });
      router.replace(customerPath(resolvedCustomerId, "measurements") as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const backHref = resolvedCustomerId
    ? customerPath(resolvedCustomerId, "measurements")
    : "/(tabs)/customers";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New measurement" onBack={() => router.replace(backHref as never)} />
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
            <Pressable key={s.id} style={[styles.chip, siteId === s.id && styles.chipOn]} onPress={() => setSiteId(s.id)}>
              <Text style={[styles.chipText, siteId === s.id && styles.chipTextOn]}>{String(s.name)}</Text>
            </Pressable>
          ))}
        </View>
        {filteredSites.length === 0 ? <Text style={{ color: p.muted }}>Add a site for this customer first.</Text> : null}
        <MeasurementEditor items={items} onChange={setItems} />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholderTextColor={p.faint}
        />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.sm },
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
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
