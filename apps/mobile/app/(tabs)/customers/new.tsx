import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateCustomer } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function NewCustomer() {
  const router = useRouter();
  const create = useCreateCustomer();
  const [type, setType] = useState<"individual" | "company">("individual");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      Toast.show({ type: "error", text1: "Name and phone required" });
      return;
    }
    try {
      const doc = await create.mutateAsync({
        type,
        name: name.trim(),
        company: company.trim() || null,
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        billingAddress: billingAddress.trim() || null,
        gstin: gstin.trim() || null,
        pan: pan.trim() || null,
        notes: notes.trim() || null,
      });
      Toast.show({ type: "success", text1: "Customer created" });
      router.replace(`/(tabs)/customers/${doc.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New customer" onBack={() => router.back()} />
        <Text style={styles.label}>Type</Text>
        <View style={styles.chips}>
          {(["individual", "company"] as const).map((t) => (
            <Pressable key={t} style={[styles.chip, type === t && styles.chipOn]} onPress={() => setType(t)}>
              <Text style={[styles.chipText, type === t && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} autoFocus />
        <Text style={styles.label}>Company</Text>
        <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Phone *</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Alternate phone</Text>
        <TextInput style={styles.input} value={alternatePhone} onChangeText={setAlternatePhone} keyboardType="phone-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={address} onChangeText={setAddress} multiline placeholderTextColor={p.faint} />
        <Text style={styles.label}>Billing address</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={billingAddress} onChangeText={setBillingAddress} multiline placeholderTextColor={p.faint} />
        <Text style={styles.label}>GSTIN</Text>
        <TextInput style={styles.input} value={gstin} onChangeText={setGstin} autoCapitalize="characters" placeholderTextColor={p.faint} />
        <Text style={styles.label}>PAN</Text>
        <TextInput style={styles.input} value={pan} onChangeText={setPan} autoCapitalize="characters" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save customer</Text>}
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
  chipText: { color: p.muted, fontSize: 13, textTransform: "capitalize" },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
