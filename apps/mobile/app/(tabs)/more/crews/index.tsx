import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

/** Legacy route — People hub (labour index) is the main entry. */
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
      subtitle="Part of People — tap + to create & link labour"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.replace("/(tabs)/labour" as never)}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/more/crews/new" as never)}
      emptyTitle="No crews"
      emptySubtitle="Create a crew and attach labour workers to it."
      renderItem={(item) => {
        const members = Array.isArray(item.members) ? item.members : [];
        const memberBit =
          members.length === 0
            ? "No labour"
            : `${members.length} labour${members.length === 1 ? "" : "s"}`;
        return (
          <RecordCard
            title={String(item.name || item.id)}
            subtitle={`${String(item.trade || item.dailyCost || "Crew")} · ${memberBit}`}
            onPress={() => router.push(`/(tabs)/more/crews/${String(item.id)}` as never)}
          />
        );
      }}
    />
  );
}
