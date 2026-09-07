import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useInvoices } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

export default function InvoicesScreen() {
  const router = useRouter();
  const q = useInvoices();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Invoices"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No invoices"
      emptySubtitle="Create from an accepted quote on the quote screen."
      renderItem={(item) => (
        <RecordCard
          title={String(item.number || item.id)}
          subtitle={formatCurrency(String(item.total_amount || item.total || 0))}
          meta={`Due ${formatCurrency(String(item.outstanding || 0))} · ${formatDate(item.createdAt)}`}
          status={String(item.status || "draft")}
          onPress={() => router.push(`/(tabs)/invoices/${item.id}`)}
        />
      )}
    />
  );
}
