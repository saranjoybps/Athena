import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateEstimate, useCustomers, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewEstimate() {
  const router = useRouter();
  const { data: custData } = useCustomers();
  const { data: siteData } = useSites();
  const create = useCreateEstimate();
  const customers = custData?.items ?? [];
  const sites = siteData?.items ?? [];
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Painting works");
  const [quantity, setQuantity] = useState("1");
  const [materialCost, setMaterialCost] = useState("0");
  const [labourCost, setLabourCost] = useState("0");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(String(customers[0].id));
  }, [customers, customerId]);

  useEffect(() => {
    const filtered = sites.filter((s) => !customerId || String(s.customerId) === customerId);
    if (!siteId && filtered[0]?.id) setSiteId(String(filtered[0].id));
  }, [sites, customerId, siteId]);

  const filteredSites = sites.filter((s) => !customerId || String(s.customerId) === customerId);

  async function submit() {
    if (!customerId || !siteId || !title.trim()) {
      Toast.show({ type: "error", text1: "Customer, site, and title required" });
      return;
    }
    try {
      const est = await create.mutateAsync({
        customerId,
        siteId,
        title: title.trim(),
        items: [
          {
            description: description || "Works",
            quantity: quantity || "1",
            unit: "sqft",
            materialCost: materialCost || "0",
            labourCost: labourCost || "0",
            rate: rate || null,
          },
        ],
      });
      void est;
      Toast.show({ type: "success", text1: "Estimate created" });
      router.replace("/(tabs)/quotes/new");
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New estimate" subtitle="Quick single-line estimate" onBack={() => router.back()} />
        <Text style={styles.label}>Customer</Text>
        <View style={styles.chips}>
          {customers.map((c) => (
            <Pressable key={c.id} style={[styles.chip, customerId === c.id && styles.chipOn]} onPress={() => { setCustomerId(c.id); setSiteId(""); }}>
              <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{String(c.name)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Site</Text>
        <View style={styles.chips}>
          {filteredSites.map((s) => (
            <Pressable key={s.id} style={[styles.chip, siteId === s.id && styles.chipOn]} onPress={() => setSiteId(s.id)}>
              <Text style={[styles.chipText, siteId === s.id && styles.chipTextOn]}>{String(s.name)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Interior painting" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Line description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Quantity</Text>
        <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Material cost</Text>
        <TextInput style={styles.input} value={materialCost} onChangeText={setMaterialCost} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Labour cost</Text>
        <TextInput style={styles.input} value={labourCost} onChangeText={setLabourCost} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Selling rate (optional)</Text>
        <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save & create quote</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
