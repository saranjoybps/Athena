import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useEstimates, usePrefetchDetail } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

export default function EstimatesScreen() {
  const router = useRouter();
  const q = useEstimates();
  const prefetch = usePrefetchDetail();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Estimates"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/estimates/new")}
      emptyTitle="No estimates"
      emptySubtitle="Build a costed scope, then create a sendable estimate."
      renderItem={(item) => {
        const computed = item.computed as { grandTotal?: string } | undefined;
        return (
          <RecordCard
            title={String(item.title || item.number || item.id)}
            subtitle={formatCurrency(String(computed?.grandTotal || item.total || 0))}
            status={item.status ? String(item.status) : undefined}
            onPress={() => {
            prefetch("estimates", item.id);
            router.push(`/(tabs)/estimates/${item.id}` as never);
          }}
          />
        );
      }}
    />
  );
}
