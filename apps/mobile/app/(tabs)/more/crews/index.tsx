import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

export default function CrewsScreen() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["crews"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/crews");
      return data;
    },
  });
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Crews"
      subtitle="Site crews"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/more/crews/new" as never)}
      emptyTitle="No crews"
      emptySubtitle="Create a crew and optionally add a labour member."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.id)}
          subtitle={String(item.trade || item.dailyCost || "")}
        />
      )}
    />
  );
}
