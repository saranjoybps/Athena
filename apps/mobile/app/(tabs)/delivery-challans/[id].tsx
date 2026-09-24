import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeliveryChallan, useDeliveryChallanPdf } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatDate } from "@/lib/format";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function DeliveryChallanDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDeliveryChallan(id);
  const pdf = useDeliveryChallanPdf();
  const doc = q.data;

  async function makePdf() {
    if (!id) return;
    try {
      const updated = await pdf.mutateAsync(id);
      Toast.show({ type: "success", text1: "PDF ready" });
      if (updated.pdfUrl) Linking.openURL(normalizePdfUrl(String(updated.pdfUrl)));
    } catch (e) {
      Toast.show({ type: "error", text1: "PDF failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title="Delivery challan" onBack={() => router.back()} />
      {q.isError ? (
        <ErrorBanner message={(q.error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => q.refetch()} />
      ) : null}
      {q.isLoading || !doc ? (
        <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{String(doc.number || doc.id)}</Text>
          <Text style={styles.meta}>
            {[
              (doc.customer as { name?: string } | undefined)?.name,
              doc.date ? formatDate(String(doc.date)) : null,
              doc.status ? String(doc.status) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.card}>
            <Row label="Vehicle" value={String(doc.vehicleNumber || "—")} />
            <Row label="Receiver" value={String(doc.receiverName || "—")} />
            {doc.notes ? <Row label="Notes" value={String(doc.notes)} /> : null}
          </View>
          <Text style={styles.section}>Lines</Text>
          {((doc.items as Array<Record<string, unknown>>) || []).map((line, i) => (
            <View key={i} style={styles.line}>
              <Text style={styles.lineDesc}>{String(line.description || "Line")}</Text>
              <Text style={styles.lineQty}>
                {String(line.quantity || "1")} {String(line.unit || "")}
              </Text>
            </View>
          ))}
          <Pressable style={styles.btn} onPress={makePdf} disabled={pdf.isPending}>
            <Text style={styles.btnText}>{pdf.isPending ? "Generating…" : doc.pdfUrl ? "Open / refresh PDF" : "Generate PDF"}</Text>
          </Pressable>
          {doc.pdfUrl ? (
            <Pressable onPress={() => Linking.openURL(normalizePdfUrl(String(doc.pdfUrl)))}>
              <Text style={styles.link}>Open existing PDF</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  title: { fontSize: 22, fontWeight: "800", color: p.text },
  meta: { color: p.muted, marginTop: 4, marginBottom: spacing.md },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    borderLeftWidth: 4,
    borderLeftColor: p.green,
    padding: spacing.md,
  },
  rowLabel: { color: p.muted, fontSize: 12, fontWeight: "600" },
  rowValue: { color: p.text, fontWeight: "600", marginTop: 2 },
  section: {
    marginTop: spacing.lg,
    marginBottom: 8,
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.border,
  },
  lineDesc: { flex: 1, color: p.text, fontWeight: "600" },
  lineQty: { color: p.muted },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { marginTop: 12, color: p.clay, fontWeight: "700", textAlign: "center" },
});
