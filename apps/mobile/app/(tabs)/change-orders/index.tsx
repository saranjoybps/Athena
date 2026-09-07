import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useChangeOrders } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

export default function ChangeOrdersScreen() {
  const router = useRouter();
  const q = useChangeOrders();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Change orders"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/change-orders/new")}
      emptyTitle="No change orders"
      emptySubtitle="Capture extra scope on site."
      renderItem={(item) => (
        <RecordCard
          title={String(item.reason || item.id)}
          subtitle={`Cost ${formatCurrency(String(item.additionalCost || 0))} · Sell ${formatCurrency(String(item.sellingPrice || 0))}`}
          status={String(item.status || "draft")}
        />
      )}
    />
  );
}
