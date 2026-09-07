import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useQuotes } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

export default function QuotesScreen() {
  const router = useRouter();
  const q = useQuotes();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Quotations"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/quotes/new")}
      emptyTitle="No quotations"
      emptySubtitle="Create from an estimate, then send to the client."
      renderItem={(item) => {
        const computed = item.computed as { grandTotal?: string } | undefined;
        return (
          <RecordCard
            title={String(item.number || item.id)}
            subtitle={formatCurrency(String(computed?.grandTotal || item.total_amount || 0))}
            meta={formatDate(item.createdAt)}
            status={String(item.status || "draft")}
            onPress={() => router.push(`/(tabs)/quotes/${item.id}`)}
          />
        );
      }}
    />
  );
}
