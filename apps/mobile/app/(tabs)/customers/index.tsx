import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useCustomers } from "@/hooks/useApi";

export default function CustomersScreen() {
  const router = useRouter();
  const q = useCustomers();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Customers"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/customers/new")}
      emptyTitle="No customers"
      emptySubtitle="Add your first customer to start a job."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={String(item.phone || "")}
          meta={String(item.address || item.email || "")}
          onPress={() => router.push(`/(tabs)/customers/${item.id}`)}
        />
      )}
    />
  );
}
