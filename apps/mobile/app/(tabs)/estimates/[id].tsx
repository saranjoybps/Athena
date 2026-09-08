import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useCreateQuote,
  useCustomer,
  useEstimate,
  useQuoteAction,
  useQuotes,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { WhatsAppShareButton } from "@/components/ui/WhatsAppShareButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { entityBackPath } from "@/lib/nav";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function EstimateDetail() {
  const { id, customerId: customerParam, fromSite } = useLocalSearchParams<{
    id: string;
    customerId?: string;
    fromSite?: string;
  }>();
  const router = useRouter();
  const { data: estimate, isLoading, isError, error, refetch } = useEstimate(id);
  const { data: quotesData, refetch: refetchQuotes, isLoading: quotesLoading, isFetched: quotesFetched } = useQuotes();
  const createQuote = useCreateQuote();
  const quoteAction = useQuoteAction();
  const customerId = customerParam || (estimate?.customerId ? String(estimate.customerId) : "");
  const { data: customer } = useCustomer(customerId || undefined);
  const [quoteId, setQuoteId] = useState<string>("");
  const [quoteStatus, setQuoteStatus] = useState<string>("draft");
  const [busy, setBusy] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const ensuringRef = useRef(false);
  const doneForEstimateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!estimate || !id || quotesLoading || !quotesFetched) return;
    if (doneForEstimateRef.current === String(id)) return;
    if (ensuringRef.current) return;

    let cancelled = false;
    ensuringRef.current = true;

    (async () => {
      try {
        setEnsureError(null);
        const list = quotesData?.items || [];
        let linked = list.find((q) => String(q.estimateId || "") === String(id));
        if (!linked) {
          const created = await createQuote.mutateAsync({
            estimateId: String(id),
            validityDays: 15,
            notes: estimate.assumptions ? String(estimate.assumptions) : undefined,
          });
          linked = created;
          await refetchQuotes();
        }
        if (cancelled) return;
        setQuoteId(String(linked.id));
        setQuoteStatus(String(linked.status || "draft"));
        doneForEstimateRef.current = String(id);
      } catch (e) {
        if (!cancelled) {
          setEnsureError((e as { userMessage?: string })?.userMessage || "Could not load quote");
        }
      } finally {
        ensuringRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate?.id, id, quotesLoading, quotesFetched]);

  async function act(action: "send" | "accept" | "reject") {
    if (!quoteId) return;
    setBusy(true);
    try {
      const updated = await quoteAction.mutateAsync({ id: quoteId, action });
      setQuoteStatus(String(updated.status || action));
      Toast.show({ type: "success", text1: `Estimate ${action === "accept" ? "approved" : action}` });
      await refetchQuotes();
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Action failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  const siteId = fromSite || (estimate?.siteId ? String(estimate.siteId) : "");
  const backHref = entityBackPath({
    customerId,
    tab: "estimates",
    siteId: null,
    siteTab: "estimates",
  });

  const items = ((estimate?.items as Record<string, unknown>[]) || []) as Record<string, unknown>[];
  const computed = (estimate?.computed as Record<string, unknown>) || {};
  const status = quoteStatus || String(estimate?.status || "draft");
  const statusLabel =
    status === "accepted"
      ? "approved"
      : status === "sent"
        ? "pending approval"
        : status === "rejected"
          ? "rejected"
          : "draft";

  const total = formatCurrency(String(computed.grandTotal || estimate?.total || "0"));
  const quoteNumber = String(estimate?.number || quoteId || "");
  const waMessage = `Hi${customer?.name ? ` ${customer.name}` : ""},\n\nPlease find our quotation ${quoteNumber} for ${String(estimate?.title || "works")} — ${total}.\n\nStatus: ${statusLabel}.\n\nThank you.`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title={String(estimate?.title || estimate?.number || "Estimate")}
          subtitle={`${statusLabel} · ${total}`}
          onBack={() => router.replace(backHref as never)}
          right={
            estimate ? (
              <WhatsAppShareButton phone={String(customer?.phone || "")} message={waMessage} label="Share quotation on WhatsApp" />
            ) : null
          }
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {ensureError ? (
          <ErrorBanner
            message={ensureError}
            onRetry={() => {
              doneForEstimateRef.current = null;
              setQuoteId("");
            }}
          />
        ) : null}

        {estimate ? (
          <>
            <View style={styles.card}>
              <Row label="Number" value={String(estimate.number || "—")} />
              <Row label="Total" value={total} />
              <Row label="Valid until" value={estimate.validUntil ? formatDate(String(estimate.validUntil)) : "—"} />
              <Row label="Lines" value={String(items.length)} />
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
              <Text style={styles.waText}>Share quotation on WhatsApp</Text>
            </Pressable>

            <View style={styles.actions}>
              {status === "draft" || status === "sent" || status === "modification_requested" ? (
                <>
                  <Btn label="Approve" onPress={() => act("accept")} disabled={busy || !quoteId} />
                  <Btn label="Reject" tone="muted" onPress={() => act("reject")} disabled={busy || !quoteId} />
                </>
              ) : null}
              {status === "accepted" ? (
                <Btn
                  label="Start project"
                  onPress={() =>
                    router.push(`/(tabs)/projects/new?quoteId=${quoteId}&estimateId=${id}` as never)
                  }
                  disabled={!quoteId}
                />
              ) : null}
            </View>

            <Text style={styles.section}>Line items</Text>
            {items.map((line, idx) => (
              <View key={idx} style={styles.line}>
                <Text style={styles.lineTitle}>{String(line.description || "Line")}</Text>
                <Text style={styles.lineMeta}>
                  {String(line.quantity)} {String(line.unit || "")} · mat {String(line.materialCost || 0)} · lab{" "}
                  {String(line.labourCost || 0)}
                  {line.rate ? ` · rate ${String(line.rate)}` : ""}
                </Text>
              </View>
            ))}
            {estimate.assumptions ? (
              <Text style={styles.assumptions}>Assumptions: {String(estimate.assumptions)}</Text>
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

function Btn({
  label,
  onPress,
  tone = "clay",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "clay" | "muted";
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.btn, tone === "muted" && styles.btnMuted, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.btnText, tone === "muted" && { color: p.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  rowLabel: { color: p.muted },
  value: { ...typography.h3, color: p.text },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  line: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  lineTitle: { color: p.text, fontWeight: "600" },
  lineMeta: { color: p.muted, fontSize: 13, marginTop: 4 },
  assumptions: { color: p.muted, fontSize: 13 },
  actions: { gap: 10 },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnMuted: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  btnText: { color: "#fff", fontWeight: "700" },
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
