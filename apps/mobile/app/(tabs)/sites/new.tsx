import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSite, useCustomers } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewSite() {
  const router = useRouter();
  const { data } = useCustomers();
  const create = useCreateSite();
  const customers = data?.items ?? [];
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(String(customers[0].id));
  }, [customers, customerId]);

  async function submit() {
    try {
      await create.mutateAsync({ customerId, name: name.trim(), address: address.trim(), pinCode: pinCode || null });
      Toast.show({ type: "success", text1: "Site created" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New site" onBack={() => router.back()} />
        <Text style={styles.label}>Customer</Text>
        <View style={styles.chips}>
          {customers.map((c) => (
            <Pressable key={c.id} style={[styles.chip, customerId === c.id && styles.chipOn]} onPress={() => setCustomerId(c.id)}>
              <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{String(c.name)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={address} onChangeText={setAddress} multiline placeholderTextColor={p.faint} />
        <Text style={styles.label}>PIN</Text>
        <TextInput style={styles.input} value={pinCode} onChangeText={setPinCode} keyboardType="number-pad" placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save site</Text>}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
