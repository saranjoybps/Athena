import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import { useStockSummary } from "@/hooks/useApi";
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
  const stock = useStockSummary();
  const stockById = new Map((stock.data?.items ?? []).map((r) => [String(r.id), r]));
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Tools"
      subtitle="Site tools and equipment — with on-hand qty"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching || stock.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => {
        q.refetch();
        stock.refetch();
      }}
      onRefresh={() => {
        q.refetch();
        stock.refetch();
      }}
      onAdd={() => router.push("/(tabs)/more/tools/new" as never)}
      emptyTitle="No tools"
      emptySubtitle="Add ladders, mixers, and other site tools."
      renderItem={(item) => {
        const s = stockById.get(String(item.id));
        const qty = s?.onHand ?? item.qty;
        const low = Boolean(s?.lowStock);
        return (
          <RecordCard
            title={String(item.name || item.materialName || "Tool")}
            subtitle={[`Qty ${String(qty ?? "—")}`, String(item.warehouse || "main"), low ? "Low stock" : null]
              .filter(Boolean)
              .join(" · ")}
          />
        );
      }}
    />
  );
}
