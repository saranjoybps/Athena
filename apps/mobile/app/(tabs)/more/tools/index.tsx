import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

export default function ToolsScreen() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/inventory");
      return data;
    },
  });
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Tools"
      subtitle="Site tools and equipment"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/more/tools/new" as never)}
      emptyTitle="No tools"
      emptySubtitle="Add ladders, mixers, and other site tools."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.materialName || "Tool")}
          subtitle={`Qty ${String(item.qty ?? "—")} · ${String(item.warehouse || "main")}`}
        />
      )}
    />
  );
}
