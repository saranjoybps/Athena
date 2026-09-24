import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { usePayments } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PaymentsScreen() {
  const router = useRouter();
  const q = usePayments();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Payments"
      subtitle="Collections & receipts"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/payments/new" as never)}
      emptyTitle="No payments yet"
      emptySubtitle="Payments recorded against invoices will show here."
      renderItem={(item) => (
        <RecordCard
          title={formatCurrency(String(item.amount || 0))}
          subtitle={String(item.method || "")}
          meta={`Invoice ${(String(item.invoiceId || "")).slice(0, 8)} · ${formatDate(item.createdAt)}`}
          onPress={() => router.push(`/(tabs)/payments/${item.id}` as never)}
        />
      )}
    />
  );
}
