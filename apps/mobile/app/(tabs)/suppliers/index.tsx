import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useSuppliers } from "@/hooks/useApi";

export default function SuppliersScreen() {
  const router = useRouter();
  const q = useSuppliers();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Suppliers"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/suppliers/new")}
      emptyTitle="No suppliers"
      emptySubtitle="Add dealers and material vendors."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={String(item.phone || item.company || "")}
          meta={String(item.address || item.gstin || "")}
          onPress={() => router.push(`/(tabs)/suppliers/${item.id}`)}
        />
      )}
    />
  );
}
