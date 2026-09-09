import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateTool } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function NewTool() {
  const router = useRouter();
  const create = useCreateTool();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [warehouse, setWarehouse] = useState("main");

  async function submit() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Tool name required" });
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        qty: qty.trim() || "0",
        warehouse: warehouse.trim() || "main",
      });
      Toast.show({ type: "success", text1: "Tool added" });
      router.replace("/(tabs)/more/tools" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Add tool" onBack={() => router.back()} />
        <Text style={styles.label}>Tool name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Warehouse</Text>
        <TextInput style={styles.input} value={warehouse} onChangeText={setWarehouse} placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
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
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
