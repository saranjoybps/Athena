import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useInvoice, useSendInvoice, useUpdateInvoice } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";
import { TextInput } from "react-native";

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useInvoice(id);
  const update = useUpdateInvoice();
  const send = useSendInvoice();
  const customer = data?.customer as { name?: string } | undefined;
  const status = String(data?.status || "draft");
  const canEdit = status === "draft" || status === "sent";
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNotes(String(data.notes || ""));
    setDueDate(String(data.dueDate || "").slice(0, 10));
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({ id: String(id), body: { notes: notes || null, dueDate: dueDate || null } });
      Toast.show({ type: "success", text1: "Invoice saved" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    try {
      await send.mutateAsync(String(id));
      Toast.show({ type: "success", text1: "Marked sent" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={String(data?.number || "Invoice")} subtitle={status} onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}
        {data ? (
          <>
            <View style={styles.card}>
              <Row label="Customer" value={customer?.name || "—"} />
              <Row label="Total" value={formatCurrency(String(data.total_amount || data.total || 0))} />
              <Row label="Outstanding" value={formatCurrency(String(data.outstanding || 0))} />
              <Row label="Created" value={formatDate(data.createdAt)} />
            </View>
            {canEdit ? (
              <View style={styles.card}>
                <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-09-30" placeholderTextColor={p.faint} />
                <Text style={styles.label}>Notes</Text>
                <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
                <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
                  <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.locked}>Paid invoices cannot be edited.</Text>
            )}
            {status === "draft" ? (
              <Pressable style={styles.btn} onPress={markSent}>
                <Text style={styles.btnText}>Mark sent</Text>
              </Pressable>
            ) : null}
            {Number(data.outstanding || 0) > 0 ? (
              <Pressable style={styles.btnMuted} onPress={() => router.push("/(tabs)/payments/new")}>
                <Text style={[styles.btnText, { color: p.text }]}>Record payment</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  rowLabel: { color: p.muted },
  value: { ...typography.h3, color: p.text },
  label: { color: p.muted, fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: p.text, backgroundColor: p.background },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnMuted: { backgroundColor: p.surface, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: p.border },
  btnText: { color: "#fff", fontWeight: "700" },
  locked: { color: p.muted },
});
