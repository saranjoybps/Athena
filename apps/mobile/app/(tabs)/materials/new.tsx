import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateMaterial } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewMaterial() {
  const router = useRouter();
  const create = useCreateMaterial();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [brand, setBrand] = useState("");
  const [hsn, setHsn] = useState("");
  const [gstRate, setGstRate] = useState("0.18");

  async function submit() {
    try {
      await create.mutateAsync({
        name: name.trim(),
        unit: unit || "pcs",
        brand: brand || null,
        defaultPurchasePrice: buy || null,
        defaultSellingPrice: sell || null,
        hsn: hsn || null,
        gstRate: gstRate ? Number(gstRate) : 0.18,
      });
      Toast.show({ type: "success", text1: "Material created" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New material" onBack={() => router.back()} />
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Unit</Text>
        <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Brand</Text>
        <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Purchase price</Text>
        <TextInput style={styles.input} value={buy} onChangeText={setBuy} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Selling price</Text>
        <TextInput style={styles.input} value={sell} onChangeText={setSell} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>HSN code</Text>
        <TextInput style={styles.input} value={hsn} onChangeText={setHsn} placeholderTextColor={p.faint} />
        <Text style={styles.label}>GST rate (e.g. 0.18)</Text>
        <TextInput style={styles.input} value={gstRate} onChangeText={setGstRate} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save material</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
