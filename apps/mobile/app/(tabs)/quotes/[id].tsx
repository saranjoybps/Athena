import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useEnsureQuotePdf,
  useInvoiceFromQuote,
  useQuote,
  useQuoteAction,
  useUpdateQuote,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DocumentSendActions } from "@/components/ui/DocumentSendActions";
import { formatCurrency, formatDate } from "@/lib/format";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useQuote(id);
  const action = useQuoteAction();
  const invoice = useInvoiceFromQuote();
  const update = useUpdateQuote();
  const ensurePdf = useEnsureQuotePdf();
  const status = String(data?.status || "draft");
  const canEdit = status === "draft" || status === "modification_requested";
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState("15");
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNotes(String(data.notes || ""));
    setValidityDays(String(data.validityDays ?? 15));
  }, [data]);

  async function run(act: "accept" | "reject") {
    try {
      await action.mutateAsync({ id: String(id), action: act });
      Toast.show({ type: "success", text1: `Estimate ${act}` });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Action failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  async function sendEmail() {
    setEmailBusy(true);
    try {
      const result = await action.mutateAsync({ id: String(id), action: "send" });
      const mail = (result.emailResult as Record<string, unknown> | undefined) || {};
      if (mail.skipped) {
        Toast.show({
          type: "info",
          text1: "Marked sent",
          text2:
            String(mail.reason) === "smtp_not_configured"
              ? "SMTP not configured — email skipped"
              : "Email skipped",
        });
      } else if (mail.error) {
        Toast.show({ type: "error", text1: "Email failed", text2: String(mail.error) });
      } else {
        Toast.show({ type: "success", text1: "Estimate emailed" });
      }
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Send failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setEmailBusy(false);
    }
  }

  async function createInvoice() {
    try {
      const inv = await invoice.mutateAsync(String(id));
      Toast.show({ type: "success", text1: "Invoice created" });
      router.push(`/(tabs)/invoices/${inv.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Invoice failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: { notes: notes || null, validityDays: Number(validityDays || 15) },
      });
      Toast.show({ type: "success", text1: "Estimate saved" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  const customer = data?.customer as { name?: string; phone?: string; email?: string } | undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={String(data?.number || "Estimate")} subtitle={status} onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}
        {data ? (
          <>
            <View style={styles.card}>
              <Row label="Customer" value={customer?.name || "—"} />
              <Row label="Total" value={formatCurrency(String(data.total_amount || (data.computed as { grandTotal?: string })?.grandTotal || 0))} />
              <Row label="Created" value={formatDate(data.createdAt)} />
              <Row label="Lines" value={String((data.line_items as unknown[] | undefined)?.length ?? (data.items as unknown[] | undefined)?.length ?? 0)} />
            </View>
            {canEdit ? (
              <View style={styles.card}>
                <Text style={styles.label}>Validity (days)</Text>
                <TextInput style={styles.input} value={validityDays} onChangeText={setValidityDays} keyboardType="numeric" placeholderTextColor={p.faint} />
                <Text style={styles.label}>Notes</Text>
                <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={p.faint} />
                <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
                  <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.locked}>Notes and validity are locked after the estimate is sent.</Text>
            )}

            <DocumentSendActions
              kind="quotation"
              number={data.number ? String(data.number) : null}
              pdfUrl={data.pdfUrl ? String(data.pdfUrl) : null}
              customerPhone={customer?.phone}
              customerEmail={customer?.email}
              emailBusy={emailBusy || action.isPending}
              onEmail={sendEmail}
              ensurePdf={async () => {
                const updated = await ensurePdf.mutateAsync(String(id));
                refetch();
                return normalizePdfUrl(String(updated.pdfUrl || ""));
              }}
            />

            <View style={styles.actions}>
              {status === "sent" || status === "draft" || status === "modification_requested" ? (
                <>
                  <Btn label="Accept" onPress={() => run("accept")} />
                  <Btn label="Reject" tone="muted" onPress={() => run("reject")} />
                </>
              ) : null}
              {status === "accepted" ? <Btn label="Create invoice" onPress={createInvoice} /> : null}
            </View>
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

function Btn({ label, onPress, tone = "clay" }: { label: string; onPress: () => void; tone?: "clay" | "muted" }) {
  return (
    <Pressable style={[styles.btn, tone === "muted" && styles.btnMuted]} onPress={onPress}>
      <Text style={[styles.btnText, tone === "muted" && { color: p.text }]}>{label}</Text>
    </Pressable>
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
  input: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
    backgroundColor: p.background,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  actions: { gap: 10 },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnMuted: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  btnText: { color: "#fff", fontWeight: "700" },
  locked: { color: p.muted },
});
