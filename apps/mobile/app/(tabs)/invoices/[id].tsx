import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useEnsureInvoicePdf, useInvoice, useSendInvoice, useVoidInvoice } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DocumentSendActions } from "@/components/ui/DocumentSendActions";
import { formatCurrency, formatDate } from "@/lib/format";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, typography, tabBarClearance } from "@/lib/theme";

export default function InvoiceDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useInvoice(id);
  const send = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const ensurePdf = useEnsureInvoicePdf();
  const [busy, setBusy] = useState(false);
  const customer = data?.customer as { name?: string; phone?: string; email?: string } | undefined;
  const status = String(data?.status || "draft");

  const total = formatCurrency(String(data?.total_amount || data?.total || 0));

  const pid = useMemo(
    () => projectId || (data?.projectId ? String(data.projectId) : ""),
    [projectId, data?.projectId],
  );

  function goBack() {
    if (pid) {
      router.replace(projectPath(pid, "money") as never);
      return;
    }
    router.replace("/(tabs)/invoices" as never);
  }

  async function markSent() {
    try {
      const result = await send.mutateAsync(String(id));
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
        Toast.show({ type: "success", text1: "Invoice emailed" });
      }
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const canEdit = status !== "paid" && status !== "void";

  async function previewPdf() {
    if (!data) return;
    setBusy(true);
    try {
      let pdfUrl = String(data.pdfUrl || "");
      if (!pdfUrl) {
        const updated = await ensurePdf.mutateAsync(String(id));
        pdfUrl = String(updated.pdfUrl || "");
      }
      if (!pdfUrl) {
        Toast.show({ type: "error", text1: "No PDF available" });
        return;
      }
      router.push(`/(tabs)/preview?url=${encodeURIComponent(pdfUrl)}&title=Invoice` as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Preview failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  async function markVoid() {
    try {
      await voidInvoice.mutateAsync(String(id));
      Toast.show({ type: "success", text1: "Invoice voided" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={String(data?.number || "Invoice")} subtitle={status} onBack={goBack} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}
        {data ? (
          <>
            <View style={styles.card}>
              <Row label="Customer" value={customer?.name || "—"} />
              <Row label="Total" value={total} />
              <Row label="Outstanding" value={formatCurrency(String(data.outstanding || 0))} />
              <Row label="Due date" value={data.dueDate ? formatDate(String(data.dueDate)) : "—"} />
              <Row label="Created" value={formatDate(data.createdAt)} />
              {data.notes ? <Row label="Notes" value={String(data.notes)} /> : null}
            </View>

            <DocumentSendActions
              kind="invoice"
              number={data.number ? String(data.number) : null}
              pdfUrl={data.pdfUrl ? String(data.pdfUrl) : null}
              customerPhone={customer?.phone}
              customerEmail={customer?.email}
              emailBusy={send.isPending}
              onEmail={markSent}
              ensurePdf={async () => {
                const updated = await ensurePdf.mutateAsync(String(id));
                refetch();
                return String(updated.pdfUrl || "");
              }}
            />

            <View style={styles.actions}>
              <Pressable style={styles.btnMuted} onPress={previewPdf} disabled={busy}>
                <Text style={[styles.btnText, { color: p.text }]}>Preview PDF</Text>
              </Pressable>
              {canEdit ? (
                <Pressable
                  style={styles.btnMuted}
                  onPress={() =>
                    router.push(`/(tabs)/invoices/${id}/edit${pid ? `?projectId=${pid}` : ""}` as never)
                  }
                >
                  <Text style={[styles.btnText, { color: p.text }]}>Edit</Text>
                </Pressable>
              ) : null}
              {Number(data.outstanding || 0) > 0 && status !== "void" ? (
                <Pressable
                  style={styles.btnMuted}
                  onPress={() =>
                    router.push(
                      `/(tabs)/payments/new?invoiceId=${id}${pid ? `&projectId=${pid}` : ""}` as never,
                    )
                  }
                >
                  <Text style={[styles.btnText, { color: p.text }]}>Record payment</Text>
                </Pressable>
              ) : null}
              {status !== "void" && status !== "paid" ? (
                <Pressable style={styles.btnDanger} onPress={markVoid}>
                  <Text style={styles.btnText}>Void invoice</Text>
                </Pressable>
              ) : null}
              {status === "void" ? <Text style={styles.locked}>This invoice is void.</Text> : null}
              {status === "paid" ? <Text style={styles.locked}>This invoice is fully paid.</Text> : null}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: tabBarClearance },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  rowLabel: { color: p.muted },
  value: { ...typography.h3, color: p.text, flexShrink: 1, textAlign: "right" },
  actions: { gap: 10, paddingBottom: 24 },
  btnMuted: { backgroundColor: p.surface, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: p.border },
  btnDanger: { backgroundColor: "#B45309", borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  locked: { color: p.muted, textAlign: "center", marginTop: 4 },
});
