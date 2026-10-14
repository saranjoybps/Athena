import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { FileText, FolderKanban, MessageCircle, PencilLine, Phone, Trash2 } from "lucide-react-native";
import { useDeletePayment, usePayment } from "@/hooks/useApi";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { ReportRow } from "@/components/reports/ReportRow";
import { useInvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { formatCurrency, formatDate } from "@/lib/format";
import { projectPath } from "@/lib/nav";
import { errorText, methodMeta } from "@/lib/payments";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

const INVOICE_STATUS: Record<string, string> = {
  paid: "Fully paid",
  partially_paid: "Part paid",
  sent: "Unpaid",
  draft: "Draft",
  void: "Void",
};

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: payment, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = usePayment(String(id));
  const remove = useDeletePayment();
  const invoiceDrawer = useInvoiceDrawer();

  const amount = formatCurrency(String(payment?.amount || 0));
  const method = methodMeta(payment?.method);
  const MethodIcon = method.icon;
  const customer = String(payment?.customerName || "");
  const phone = String(payment?.customerPhone || "").trim();
  const projectId = payment?.projectId ? String(payment.projectId) : "";
  const invoiceId = payment?.invoiceId ? String(payment.invoiceId) : "";
  const invoiceNo = String(payment?.invoiceNumber || "Invoice");
  const outstanding = Number(payment?.invoiceOutstanding ?? 0);

  async function sendReceipt() {
    if (!payment) return;
    const lines = [
      `Hi${customer ? ` ${customer}` : ""},`,
      "",
      `We've received your payment of ${amount} by ${method.label} on ${formatDate(String(payment.createdAt || ""))}.`,
      `Invoice: ${invoiceNo}${payment.projectName ? ` (${String(payment.projectName)})` : ""}`,
      payment.reference ? `Reference: ${String(payment.reference)}` : "",
      outstanding > 0 ? `Balance due: ${formatCurrency(outstanding)}` : "This invoice is now fully paid.",
      "",
      "Thank you!",
    ].filter((l, i, all) => l !== "" || (all[i - 1] ?? "") !== "");
    try {
      await shareViaWhatsApp({ phone, message: lines.join("\n") });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't open WhatsApp", text2: (e as Error).message });
    }
  }

  function confirmDelete() {
    if (!payment) return;
    Alert.alert(
      `Delete payment of ${amount}?`,
      `This payment will be permanently deleted and ${amount} added back to invoice ${invoiceNo}'s balance. If this payment completed the project, it moves back to its previous status.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete payment",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await remove.mutateAsync(payment);
              Toast.show({
                type: "success",
                text1: "Payment deleted",
                text2: result.projectReopened
                  ? "The invoice balance is open again and the project moved back to its previous status."
                  : "The amount was added back to the invoice balance.",
              });
              router.back();
            } catch (e) {
              Toast.show({ type: "error", text1: "Couldn't delete payment", text2: errorText(e) });
            }
          },
        },
      ],
    );
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={() => refetch()} tintColor={p.clay} />
          }
        >
          <ScreenHeader
            title="Payment"
            subtitle={payment?.number ? String(payment.number) : undefined}
            onBack={() => router.back()}
            right={
              payment ? (
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => router.push(`/(tabs)/payments/${String(id)}/edit` as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit payment"
                  hitSlop={6}
                >
                  <PencilLine size={18} color={p.text} strokeWidth={2.3} />
                </Pressable>
              ) : null
            }
          />

          {isLoading && !payment ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {isError && !payment ? (
            <ErrorBanner message={errorText(error) || "Couldn't load the payment."} onRetry={() => refetch()} />
          ) : null}
          {!isLoading && !isError && !payment ? (
            <EmptyState title="Payment not found" subtitle="It may have been deleted." />
          ) : null}

          {payment ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.heroLabel}>Received</Text>
                <Text style={styles.heroAmount}>{amount}</Text>
                <View style={styles.heroMeta}>
                  <View style={styles.methodPill}>
                    <MethodIcon size={14} color={p.green} strokeWidth={2.4} />
                    <Text style={styles.methodText}>{method.label}</Text>
                  </View>
                  <Text style={styles.heroDate}>{formatDate(String(payment.createdAt || ""))}</Text>
                </View>
                {payment.reference ? <Text style={styles.heroRef}>Ref: {String(payment.reference)}</Text> : null}
              </View>

              <Text style={styles.section}>Customer</Text>
              <View style={styles.customerCard}>
                <View style={styles.customerHead}>
                  <Avatar name={customer || "Customer"} seed={String(payment.customerId || customer)} size={46} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {customer || "Customer"}
                    </Text>
                    <Text style={styles.customerPhone}>{phone || "No phone number"}</Text>
                  </View>
                </View>
                <View style={styles.contactRow}>
                  {phone ? (
                    <Pressable
                      style={styles.contactBtn}
                      onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)}
                      accessibilityRole="button"
                    >
                      <Phone size={16} color={p.text} strokeWidth={2.3} />
                      <Text style={styles.contactText}>Call</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.contactBtn, styles.waBtn]} onPress={sendReceipt} accessibilityRole="button">
                    <MessageCircle size={16} color="#fff" strokeWidth={2.3} />
                    <Text style={[styles.contactText, { color: "#fff" }]}>Send receipt</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.section}>Linked to</Text>
              {projectId ? (
                <ReportRow
                  title={String(payment.projectName || "Project")}
                  subtitle={payment.projectStatus ? `Status: ${String(payment.projectStatus).replace("_", " ")}` : "Open project"}
                  icon={FolderKanban}
                  seed={projectId}
                  onPress={() => router.push(projectPath(projectId, "money") as never)}
                />
              ) : null}
              {invoiceId ? (
                <ReportRow
                  title={invoiceNo}
                  subtitle={INVOICE_STATUS[String(payment.invoiceStatus || "")] || "Invoice"}
                  amount={formatCurrency(String(payment.invoiceTotal || 0))}
                  meta={outstanding > 0 ? `${formatCurrency(outstanding)} due` : "Settled"}
                  metaTone={outstanding > 0 ? "warning" : "positive"}
                  icon={FileText}
                  seed={invoiceId}
                  onPress={() => invoiceDrawer.open(invoiceId)}
                />
              ) : null}

              {payment.notes ? (
                <>
                  <Text style={styles.section}>Notes</Text>
                  <View style={styles.notes}>
                    <Text style={styles.notesText}>{String(payment.notes)}</Text>
                  </View>
                </>
              ) : null}

              <Pressable
                style={styles.secondary}
                onPress={() => router.push(`/(tabs)/payments/${String(id)}/edit` as never)}
                accessibilityRole="button"
              >
                <PencilLine size={18} color={p.text} strokeWidth={2.3} />
                <Text style={styles.secondaryText}>Edit payment</Text>
              </Pressable>
              <Pressable
                style={[styles.danger, remove.isPending && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={remove.isPending}
                accessibilityRole="button"
              >
                {remove.isPending ? (
                  <ActivityIndicator color={p.red} />
                ) : (
                  <>
                    <Trash2 size={18} color={p.red} strokeWidth={2.4} />
                    <Text style={styles.dangerText}>Delete payment</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      {invoiceDrawer.element}
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    ...softShadow,
  },
  hero: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.lg,
    alignItems: "center",
    ...softShadow,
  },
  heroLabel: { color: p.muted, fontSize: 13, fontWeight: "700" },
  heroAmount: { color: p.green, fontSize: 34, fontWeight: "800", marginTop: 4 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: p.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  methodText: { color: p.green, fontWeight: "700", fontSize: 12 },
  heroDate: { color: p.muted, fontSize: 13, fontWeight: "600" },
  heroRef: { color: p.muted, fontSize: 12, marginTop: 8 },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  customerCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    ...softShadow,
  },
  customerHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  customerName: { color: p.text, fontSize: 16, fontWeight: "700" },
  customerPhone: { color: p.muted, fontSize: 13, marginTop: 2 },
  contactRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  waBtn: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  contactText: { color: p.text, fontWeight: "700", fontSize: 14 },
  notes: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
  },
  notesText: { color: p.text, fontSize: 14, lineHeight: 20 },
  secondary: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  secondaryText: { color: p.text, fontWeight: "700", fontSize: 15 },
  danger: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: p.redSoft,
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
});
