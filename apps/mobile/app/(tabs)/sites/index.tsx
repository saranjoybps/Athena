import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useSites } from "@/hooks/useApi";

export default function SitesScreen() {
  const router = useRouter();
  const q = useSites();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Sites"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/sites/new")}
      emptyTitle="No sites"
      emptySubtitle="Add a job location for a customer."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={String(item.address || "")}
          meta={String(item.pinCode || item.siteType || "")}
          onPress={() => router.push(`/(tabs)/sites/${item.id}`)}
        />
      )}
    />
  );
}
