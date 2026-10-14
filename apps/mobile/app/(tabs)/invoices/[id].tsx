import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { InvoiceActions, InvoiceBody, useInvoiceState, type InvoiceNav } from "@/components/invoices/InvoiceView";
import { goBackOr, projectPath } from "@/lib/nav";
import { lightPalette as p, spacing, tabBarClearance } from "@/lib/theme";

/** Full-screen invoice for deep links; lists open the same view in a drawer. */
export default function InvoiceDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { invoiceQ, invoice, number, customer, kindLabel } = useInvoiceState(id);
  const pid = String(projectId || invoice?.projectId || "");

  const nav = useMemo<InvoiceNav>(
    () => ({
      edit: (invoiceId, proj) => router.push(`/(tabs)/invoices/${invoiceId}/edit${proj ? `?projectId=${proj}` : ""}` as never),
      recordPayment: (invoiceId, proj) => router.push(`/(tabs)/payments/new?invoiceId=${invoiceId}${proj ? `&projectId=${proj}` : ""}` as never),
      payment: (paymentId) => router.push(`/(tabs)/payments/${paymentId}` as never),
      project: (proj) => router.push(projectPath(proj, "money") as never),
    }),
    [router],
  );

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={invoiceQ.isRefetching} onRefresh={() => invoiceQ.refetch()} tintColor={p.clay} />}
        >
          <ScreenHeader
            title={invoice ? number : "Invoice"}
            subtitle={invoice ? [customer?.company || customer?.name, kindLabel].filter(Boolean).join(" · ") : undefined}
            onBack={() => goBackOr(router, pid ? projectPath(pid, "money") : "/(tabs)/invoices")}
          />
          <InvoiceBody id={String(id)} nav={nav} />
          <View style={styles.actions}>
            <InvoiceActions id={String(id)} nav={nav} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: tabBarClearance },
  actions: { backgroundColor: p.surface, borderRadius: 22, borderWidth: 1, borderColor: p.border, padding: spacing.md },
});
