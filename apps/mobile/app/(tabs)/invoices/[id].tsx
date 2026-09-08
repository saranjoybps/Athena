import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useInvoice, useSendInvoice, useVoidInvoice } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { WhatsAppShareButton } from "@/components/ui/WhatsAppShareButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { projectPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function InvoiceDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useInvoice(id);
  const send = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const customer = data?.customer as { name?: string; phone?: string } | undefined;
  const status = String(data?.status || "draft");

  const total = formatCurrency(String(data?.total_amount || data?.total || 0));
  const waMessage = `Hi${customer?.name ? ` ${customer.name}` : ""},\n\nInvoice ${String(data?.number || "")} — ${total}.\nOutstanding: ${formatCurrency(String(data?.outstanding || 0))}.\nStatus: ${status}.\n\nThank you.`;

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
      await send.mutateAsync(String(id));
      Toast.show({ type: "success", text1: "Marked sent" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
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
        <ScreenHeader
          title={String(data?.number || "Invoice")}
          subtitle={status}
          onBack={goBack}
          right={
            data ? (
              <WhatsAppShareButton phone={String(customer?.phone || "")} message={waMessage} label="Share invoice on WhatsApp" />
            ) : null
          }
        />
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

            <Pressable
              style={styles.waRow}
              onPress={() =>
                shareViaWhatsApp({ phone: String(customer?.phone || ""), message: waMessage }).catch((e) =>
                  Toast.show({ type: "error", text1: "Could not open WhatsApp", text2: (e as Error).message }),
                )
              }
            >
              <WhatsAppShareButton phone={String(customer?.phone || "")} message={waMessage} />
              <Text style={styles.waText}>Share invoice on WhatsApp</Text>
            </Pressable>

            <View style={styles.actions}>
              {status === "draft" ? (
                <Pressable style={styles.btn} onPress={markSent}>
                  <Text style={styles.btnText}>Mark sent</Text>
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  rowLabel: { color: p.muted },
  value: { ...typography.h3, color: p.text, flexShrink: 1, textAlign: "right" },
  actions: { gap: 10, paddingBottom: 24 },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnMuted: { backgroundColor: p.surface, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: p.border },
  btnDanger: { backgroundColor: "#B45309", borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  locked: { color: p.muted, textAlign: "center", marginTop: 4 },
  waRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  waText: { color: p.text, fontWeight: "700", flex: 1 },
});
