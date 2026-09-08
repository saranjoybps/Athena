import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreatePayment, useInvoice, useInvoices } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

const METHODS = ["upi", "cash", "bank", "cheque", "card"];

export default function NewPayment() {
  const router = useRouter();
  const { invoiceId: invoiceParam, projectId: projectParam } = useLocalSearchParams<{
    invoiceId?: string;
    projectId?: string;
  }>();
  const { data } = useInvoices();
  const selectedInvoice = useInvoice(invoiceParam);
  const create = useCreatePayment();
  const invoices = (data?.items ?? []).filter((i) => !["paid", "cancelled", "void"].includes(String(i.status)));
  const [invoiceId, setInvoiceId] = useState(invoiceParam || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const projectId = useMemo(
    () => projectParam || (selectedInvoice.data?.projectId ? String(selectedInvoice.data.projectId) : ""),
    [projectParam, selectedInvoice.data?.projectId],
  );

  function backToInvoice() {
    const inv = invoiceId || invoiceParam;
    if (inv) {
      router.replace(
        `/(tabs)/invoices/${inv}${projectId ? `?projectId=${projectId}` : ""}` as never,
      );
      return;
    }
    router.replace("/(tabs)/invoices" as never);
  }

  useEffect(() => {
    if (invoiceParam) setInvoiceId(String(invoiceParam));
  }, [invoiceParam]);

  useEffect(() => {
    const items = data?.items ?? [];
    const open = items.filter((i) => !["paid", "cancelled", "void"].includes(String(i.status)));
    if (!invoiceId && open[0]?.id) setInvoiceId(String(open[0].id));
  }, [data?.items, invoiceId]);

  useEffect(() => {
    if (!invoiceId || !data?.items) return;
    const inv = data.items.find((i) => String(i.id) === String(invoiceId));
    if (!inv) return;
    const next = String(inv.outstanding || inv.total_amount || inv.total || "");
    setAmount((prev) => (prev === next || prev === "" ? next : prev));
  }, [invoiceId, data?.items]);

  async function submit() {
    if (!invoiceId || !amount) {
      Toast.show({ type: "error", text1: "Invoice and amount required" });
      return;
    }
    try {
      await create.mutateAsync({
        invoiceId,
        amount,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      Toast.show({ type: "success", text1: "Payment recorded" });
      router.replace(
        `/(tabs)/invoices/${invoiceId}${projectId ? `?projectId=${projectId}` : ""}` as never,
      );
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Record payment" onBack={backToInvoice} />
        {!invoiceParam ? (
          <>
            <Text style={styles.label}>Invoice</Text>
            <View style={styles.chips}>
              {invoices.map((inv) => (
                <Pressable
                  key={inv.id}
                  style={[styles.chip, invoiceId === inv.id && styles.chipOn]}
                  onPress={() => setInvoiceId(inv.id)}
                >
                  <Text style={[styles.chipText, invoiceId === inv.id && styles.chipTextOn]} numberOfLines={1}>
                    {String(inv.number || inv.id)} · {formatCurrency(String(inv.outstanding || 0))}
                  </Text>
                </Pressable>
              ))}
            </View>
            {invoices.length === 0 ? <Text style={{ color: p.muted }}>No open invoices.</Text> : null}
          </>
        ) : (
          <Text style={styles.locked}>
            Paying {String(selectedInvoice.data?.number || invoiceParam)} · outstanding{" "}
            {formatCurrency(String(selectedInvoice.data?.outstanding || amount || 0))}
          </Text>
        )}
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={p.faint} />
        <Text style={styles.label}>Method</Text>
        <View style={styles.chips}>
          {METHODS.map((m) => (
            <Pressable key={m} style={[styles.chip, method === m && styles.chipOn]} onPress={() => setMethod(m)}>
              <Text style={[styles.chipText, method === m && styles.chipTextOn]}>{m.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Reference</Text>
        <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholderTextColor={p.faint} />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 70 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholderTextColor={p.faint}
        />
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save payment</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  locked: { color: p.muted, marginBottom: 8 },
  input: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: p.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface, maxWidth: "100%" },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
