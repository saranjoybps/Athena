import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useMaterials } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

export default function MaterialsScreen() {
  const router = useRouter();
  const q = useMaterials();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Materials"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/materials/new")}
      emptyTitle="No materials"
      emptySubtitle="Build your catalog for estimates and stock."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={`${String(item.unit || "")} · ${formatCurrency(String(item.defaultSellingPrice || item.defaultPurchasePrice || 0))}`}
          meta={String(item.brand || item.category || "")}
          onPress={() => router.push(`/(tabs)/materials/${item.id}`)}
        />
      )}
    />
  );
}
